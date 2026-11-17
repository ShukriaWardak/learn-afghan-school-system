<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/record_validation.php';
require_once dirname(__DIR__).'/task_log.php';
requestMethod('POST'); assertSameOrigin(); verifyCsrf();
$pdo=database(); $user=authenticatedUser($pdo); $body=jsonBody();
try {
 $title=recordText($body,'title',180);
 $date=taskLogDate($body['task_date']??null);
 $due=($body['due_date']??'')===''?null:taskLogDate($body['due_date']);
 if ($due!==null && $due<$date) throw new InvalidArgumentException('Deadline cannot precede the task date');
 $description=taskLogNotes($body,'description'); $notes=taskLogNotes($body,'progress_notes');
 $status=$body['status']??null;
 if (!in_array($status,['not_started','in_progress','completed'],true)) throw new InvalidArgumentException('Invalid task status');
 $id=array_key_exists('id',$body)?recordId($body,'id'):null;
 if ($id!==null) $version=recordId($body,'version');
} catch (InvalidArgumentException $e) {respond(400,['error'=>$e->getMessage()]);}
try {
 $pdo->beginTransaction();
 if ($id===null) {
  $stmt=$pdo->prepare('INSERT INTO task_log(owner_user_id,task_date,title,description,due_date,status,progress_notes) VALUES(?,?,?,?,?,?,?)');
  $stmt->execute([(int)$user['id'],$date,$title,$description,$due,$status,$notes]);
  $id=(int)$pdo->lastInsertId(); $action='task.create';
 } else {
  $stmt=$pdo->prepare('SELECT version FROM task_log WHERE id=? AND owner_user_id=? FOR UPDATE');
  $stmt->execute([$id,(int)$user['id']]); $row=$stmt->fetch();
  if (!$row) {$pdo->rollBack();respond(404,['error'=>'Editable task not found']);}
  if ((int)$row['version']!==$version) {$pdo->rollBack();respond(409,['error'=>'Task changed. Refresh the list and reopen it before editing.']);}
  $stmt=$pdo->prepare('UPDATE task_log SET task_date=?,title=?,description=?,due_date=?,status=?,progress_notes=?,version=version+1 WHERE id=? AND owner_user_id=?');
  $stmt->execute([$date,$title,$description,$due,$status,$notes,$id,(int)$user['id']]); $action='task.update';
 }
 $stmt=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?)');
 $stmt->execute([(int)$user['id'],$action,'task',(string)$id]);
 $pdo->commit(); respond($action==='task.create'?201:200,['saved'=>true,'id'=>$id]);
} catch (Throwable $e) {
 if ($pdo->inTransaction()) $pdo->rollBack();
 error_log('LEARN task log save failed');
 respond(500,['error'=>'Task could not be saved. Check database setup; no change was committed.']);
}
