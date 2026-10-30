<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$pdo=database();$user=authenticatedUser($pdo);
// This central directory is restricted until department-specific privileges are approved.
if ($user['role']!=='super_admin') respond(403,['error'=>'Department directory access denied']);
$stmt=$pdo->query('SELECT d.id,d.code,d.name,d.parent_id,p.name AS parent_name FROM departments d LEFT JOIN departments p ON p.id=d.parent_id ORDER BY d.name,d.id');
respond(200,['departments'=>$stmt->fetchAll()]);
