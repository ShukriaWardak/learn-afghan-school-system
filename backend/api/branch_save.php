<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/management.php';

requestMethod('POST');
assertSameOrigin();
verifyCsrf();
$pdo = database();
$user = requireSuperAdmin($pdo);
$body = jsonBody();

$action = $body['action'] ?? null;
if ($action !== 'create' && $action !== 'update') respond(422, ['error' => 'Invalid action']);
$id = $action === 'update' ? positiveId($body['id'] ?? null, 'branch id') : null;
$zoneId = positiveId($body['zone_id'] ?? null, 'zone id');
$code = codeField($body);
$name = textField($body, 'name', 180);
$location = textField($body, 'location', 250, false);
$status = $body['status'] ?? 'pending';
if (!is_string($status) || !in_array($status, ['pending', 'active', 'inactive'], true)) {
    respond(422, ['error' => 'Invalid status']);
}

try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT id FROM zones WHERE id=?');
    $stmt->execute([$zoneId]);
    if (!$stmt->fetch()) {
        $pdo->rollBack();
        respond(422, ['error' => 'The selected zone does not exist']);
    }

    $after = ['zone_id' => $zoneId, 'code' => $code, 'name' => $name,
              'location' => $location, 'status' => $status];
    if ($action === 'create') {
        $stmt = $pdo->prepare(
            'INSERT INTO branches(zone_id,code,name,location,status) VALUES(?,?,?,?,?)'
        );
        $stmt->execute([$zoneId, $code, $name, $location, $status]);
        $id = (int) $pdo->lastInsertId();
        auditChange($pdo, $user, 'create', 'branch', $id, ['after' => $after]);
    } else {
        $stmt = $pdo->prepare(
            'SELECT zone_id,code,name,location,status FROM branches WHERE id=? FOR UPDATE'
        );
        $stmt->execute([$id]);
        $before = $stmt->fetch();
        if (!$before) {
            $pdo->rollBack();
            respond(404, ['error' => 'Branch record not found']);
        }
        $stmt = $pdo->prepare(
            'UPDATE branches SET zone_id=?,code=?,name=?,location=?,status=? WHERE id=?'
        );
        $stmt->execute([$zoneId, $code, $name, $location, $status, $id]);
        auditChange($pdo, $user, 'update', 'branch', $id, [
            'before' => $before, 'after' => $after
        ]);
    }

    $pdo->commit();
    respond($action === 'create' ? 201 : 200, ['branch' => ['id' => $id, ...$after]]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    managementFailure($e);
}
