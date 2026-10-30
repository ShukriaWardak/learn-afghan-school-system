<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$pdo=database();$user=authenticatedUser($pdo);
if ($user['role']!=='super_admin') respond(403,['error'=>'Branch administrator directory access denied']);
$stmt=$pdo->query("SELECT u.id,u.display_name,u.username,u.active,b.name AS branch_name,z.name AS zone_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN zones z ON z.id=b.zone_id WHERE u.role='branch_admin' ORDER BY u.display_name,u.id LIMIT 1000");
respond(200,['admins'=>$stmt->fetchAll(),'limit'=>1000]);
