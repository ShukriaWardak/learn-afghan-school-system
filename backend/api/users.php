<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$pdo=database();
$u=authenticatedUser($pdo);
if ($u['role']!=='super_admin') respond(403,['error'=>'Account directory access denied']);
$stmt=$pdo->query("SELECT u.id,u.username,u.display_name,u.role,u.active,u.created_at,
 z.name AS zone_name,b.name AS branch_name,d.name AS department_name
 FROM users u LEFT JOIN zones z ON z.id=u.zone_id
 LEFT JOIN branches b ON b.id=u.branch_id
 LEFT JOIN departments d ON d.id=u.department_id
 ORDER BY u.id LIMIT 200");
respond(200,['users'=>$stmt->fetchAll(),'limit'=>200]);
