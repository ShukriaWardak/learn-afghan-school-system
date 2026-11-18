<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/task_log.php';
requestMethod('GET');
$pdo=database(); $user=authenticatedUser($pdo);
[$where,$args]=taskLogScope($user);
try {
 $stmt=$pdo->prepare('SELECT t.*,u.display_name AS owner_name,b.name AS branch_name FROM task_log t JOIN users u ON u.id=t.owner_user_id LEFT JOIN branches b ON b.id=u.branch_id WHERE '.$where.' ORDER BY t.task_date DESC,t.id DESC LIMIT 501');
 $stmt->execute($args); $rows=$stmt->fetchAll(); $more=count($rows)>500;
 $rows=array_slice($rows,0,500);
 foreach ($rows as &$row) {
  $row['id']=(int)$row['id']; $row['version']=(int)$row['version']; $row['owner_user_id']=(int)$row['owner_user_id'];
  $row['can_edit']=$row['owner_user_id']===(int)$user['id'];
 }
 unset($row);
 respond(200,['tasks'=>$rows,'has_more'=>$more]);
} catch (PDOException $e) {
 error_log('LEARN task log read failed');
 respond(503,['error'=>'Task log unavailable. Check local setup and migration 007_task_log.sql.']);
}
