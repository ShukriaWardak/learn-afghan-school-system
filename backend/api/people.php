<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/management.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    respond(405, ['error' => 'Method not allowed']);
}
$kind = $_GET['kind'] ?? '';
if (!is_string($kind) || !in_array($kind, ['teacher', 'staff'], true)) {
    respond(422, ['error' => 'Choose teacher or staff']);
}
$pdo = database();
$actor = authenticatedUser($pdo);

// Table/column names are mapped from constants only, never request interpolations.
$isTeacher = $kind === 'teacher';
$table = $isTeacher ? 'teacher_records' : 'staff_records';

if ($method === 'GET') {
    $fields = $isTeacher
        ? 'p.id,p.code,p.display_name,p.branch_id,p.status,b.name AS branch_name,z.name AS zone_name'
        : 'p.id,p.code,p.display_name,p.branch_id,p.department_id,p.status,'
            . 'b.name AS branch_name,z.name AS zone_name,d.name AS department_name';
    $join = ' FROM ' . $table . ' p'
        . ' LEFT JOIN branches b ON b.id=p.branch_id'
        . ' LEFT JOIN zones z ON z.id=b.zone_id';
    if (!$isTeacher) $join .= ' JOIN departments d ON d.id=p.department_id';
    $where = '';
    $params = [];
    switch ($actor['role']) {
        case 'super_admin':
            break;
        case 'zone_admin':
            if (!$actor['zone_id']) respond(403, ['error' => 'Zone assignment required']);
            $where = ' WHERE b.zone_id=?';
            $params = [(int) $actor['zone_id']];
            break;
        case 'branch_admin':
            if (!$actor['branch_id']) respond(403, ['error' => 'Branch assignment required']);
            $where = ' WHERE p.branch_id=?';
            $params = [(int) $actor['branch_id']];
            break;
        default:
            respond(403, ['error' => 'Directory access denied']);
    }
    try {
        $stmt = $pdo->prepare('SELECT ' . $fields . $join . $where . ' ORDER BY p.code LIMIT 500');
        $stmt->execute($params);
        respond(200, ['records' => $stmt->fetchAll()]);
    } catch (PDOException $e) {
        error_log('LEARN people directory unavailable');
        respond(503, ['error' => 'Directory unavailable: confirm that migration 003 was imported']);
    }
}

// POST: Only a database-verified Super Admin can write personnel directory records.
assertSameOrigin();
verifyCsrf();
if ($actor['role'] !== 'super_admin') respond(403, ['error' => 'Super admin access required']);
$body = jsonBody();
$action = $body['action'] ?? null;
if (!in_array($action, ['create','update'], true)) respond(422, ['error' => 'Invalid action']);
$id = $action === 'update' ? positiveId($body['id'] ?? null, 'record id') : null;
$code = codeField($body);
$name = textField($body, 'display_name', 180);
$status = $body['status'] ?? 'pending';
if (!is_string($status) || !in_array($status, ['pending','active','inactive'], true)) {
    respond(422, ['error' => 'Invalid status']);
}
$branchId = null;
if ($isTeacher || (isset($body['branch_id']) && $body['branch_id'] !== '' && $body['branch_id'] !== null)) {
    $branchId = positiveId($body['branch_id'] ?? null, 'branch id');
}
$departmentId = $isTeacher ? null : positiveId($body['department_id'] ?? null, 'department id');

try {
    $pdo->beginTransaction();
    if ($branchId !== null) {
        $check = $pdo->prepare('SELECT id FROM branches WHERE id=?');
        $check->execute([$branchId]);
        if (!$check->fetch()) {
            $pdo->rollBack();
            respond(422, ['error' => 'Selected branch does not exist']);
        }
    }
    if (!$isTeacher) {
        $check = $pdo->prepare('SELECT id FROM departments WHERE id=?');
        $check->execute([$departmentId]);
        if (!$check->fetch()) {
            $pdo->rollBack();
            respond(422, ['error' => 'Selected department does not exist']);
        }
    }
    $after = ['code' => $code, 'branch_id' => $branchId, 'status' => $status];
    if (!$isTeacher) $after['department_id'] = $departmentId;

    if ($action === 'create') {
        if ($isTeacher) {
            $stmt = $pdo->prepare('INSERT INTO teacher_records(code,display_name,branch_id,status) VALUES(?,?,?,?)');
            $stmt->execute([$code,$name,$branchId,$status]);
        } else {
            $stmt = $pdo->prepare('INSERT INTO staff_records(code,display_name,department_id,branch_id,status) VALUES(?,?,?,?,?)');
            $stmt->execute([$code,$name,$departmentId,$branchId,$status]);
        }
        $id = (int) $pdo->lastInsertId();
        // Do not copy personal names into the audit JSON.
        auditChange($pdo, $actor, 'create', $kind, $id, ['after' => $after]);
    } else {
        $select = $isTeacher
            ? 'SELECT code,branch_id,status FROM teacher_records WHERE id=? FOR UPDATE'
            : 'SELECT code,branch_id,department_id,status FROM staff_records WHERE id=? FOR UPDATE';
        $stmt = $pdo->prepare($select);
        $stmt->execute([$id]);
        $before = $stmt->fetch();
        if (!$before) {
            $pdo->rollBack();
            respond(404, ['error' => 'Record not found']);
        }
        if ($isTeacher) {
            $stmt = $pdo->prepare('UPDATE teacher_records SET code=?,display_name=?,branch_id=?,status=? WHERE id=?');
            $stmt->execute([$code,$name,$branchId,$status,$id]);
        } else {
            $stmt = $pdo->prepare('UPDATE staff_records SET code=?,display_name=?,department_id=?,branch_id=?,status=? WHERE id=?');
            $stmt->execute([$code,$name,$departmentId,$branchId,$status,$id]);
        }
        auditChange($pdo, $actor, 'update', $kind, $id, ['before' => $before,'after' => $after]);
    }
    $pdo->commit();
    respond($action === 'create' ? 201 : 200, ['record' => ['id' => $id]]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    managementFailure($e);
}
