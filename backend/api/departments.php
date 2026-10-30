<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/management.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    respond(405, ['error' => 'Method not allowed']);
}

$pdo = database();
$actor = requireSuperAdmin($pdo);

if ($method === 'GET') {
    $rows = $pdo->query('SELECT id, code, name, parent_id FROM departments ORDER BY code')->fetchAll();
    respond(200, ['departments' => $rows]);
}

assertSameOrigin();
verifyCsrf();
$body = jsonBody();
$action = $body['action'] ?? null;
if ($action !== 'create' && $action !== 'update') {
    respond(422, ['error' => 'Invalid action']);
}
$id = $action === 'update' ? positiveId($body['id'] ?? null, 'department id') : null;
$code = textField($body, 'code', 45);
if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{1,44}$/D', $code)) {
    respond(422, ['error' => 'Code must be 2-45 letters, numbers, hyphens or underscores']);
}
$code = strtoupper($code);
$name = textField($body, 'name', 180);

try {
    $pdo->beginTransaction();
    $after = ['code' => $code, 'name' => $name];
    if ($action === 'create') {
        // The first release creates top-level departments only.
        $stmt = $pdo->prepare('INSERT INTO departments(code, name, parent_id) VALUES(?, ?, NULL)');
        $stmt->execute([$code, $name]);
        $id = (int) $pdo->lastInsertId();
        auditChange($pdo, $actor, 'create', 'department', $id, ['after' => $after]);
    } else {
        $stmt = $pdo->prepare('SELECT code, name, parent_id FROM departments WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        $before = $stmt->fetch();
        if (!$before) {
            $pdo->rollBack();
            respond(404, ['error' => 'Department not found']);
        }
        // Preserve any existing hierarchy. Hierarchy editing is not in this release.
        $stmt = $pdo->prepare('UPDATE departments SET code = ?, name = ? WHERE id = ?');
        $stmt->execute([$code, $name, $id]);
        auditChange($pdo, $actor, 'update', 'department', $id, [
            'before' => $before, 'after' => [...$after, 'parent_id' => $before['parent_id']]
        ]);
    }
    $pdo->commit();
    respond($action === 'create' ? 201 : 200, ['department' => ['id' => $id, ...$after]]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    managementFailure($e);
}
