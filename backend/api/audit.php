<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$pdo=database();
$u=authenticatedUser($pdo);
if ($u['role']!=='super_admin') respond(403,['error'=>'Audit history access denied']);
$stmt=$pdo->query("SELECT a.id,a.action,a.entity_type,a.entity_id,a.created_at,
 u.display_name AS actor
 FROM audit_events a LEFT JOIN users u ON u.id=a.actor_user_id
 ORDER BY a.id DESC LIMIT 100");
respond(200,['events'=>$stmt->fetchAll(),'limit'=>100]);
