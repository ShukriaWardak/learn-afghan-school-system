<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/management.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'GET' && $method !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['error' => 'Method not allowed']);
}
$pdo = database();
$user = requireSuperAdmin($pdo);

if ($method === 'GET') {
    $zones = $pdo->query('SELECT id,code,name FROM zones ORDER BY code')->fetchAll();
    respond(200, ['zones' => $zones]);
}

assertSameOrigin();
verifyCsrf();
$body = jsonBody();
$code = codeField($body);
$name = textField($body, 'name', 150);

try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT INTO zones(code,name) VALUES(?,?)');
    $stmt->execute([$code, $name]);
    $zoneId = (int) $pdo->lastInsertId();
    auditChange($pdo, $user, 'create', 'zone', $zoneId, ['code' => $code, 'name' => $name]);
    $pdo->commit();
    respond(201, ['zone' => ['id' => $zoneId, 'code' => $code, 'name' => $name]]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    managementFailure($e);
}
