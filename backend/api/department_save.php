<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/record_validation.php';
requestMethod('POST');assertSameOrigin();verifyCsrf();
$pdo=database();$user=authenticatedUser($pdo);
if ($user['role']!=='super_admin') respond(403,['error'=>'Only the super administrator may manage departments']);
$body=jsonBody();
try {
 $name=recordText($body,'name',180);
 $id=array_key_exists('id',$body)?recordId($body,'id'):null;
 $code=$id===null?recordCode($body):null;
} catch (InvalidArgumentException $e) {respond(400,['error'=>$e->getMessage()]);}
try {
 $pdo->beginTransaction();
 if ($id===null) {
  $stmt=$pdo->prepare('INSERT INTO departments(code,name) VALUES(?,?)');$stmt->execute([$code,$name]);
  $id=(int)$pdo->lastInsertId();$action='department.create';
 } else {
  $stmt=$pdo->prepare('SELECT id FROM departments WHERE id=? FOR UPDATE');$stmt->execute([$id]);
  if (!$stmt->fetch()) {$pdo->rollBack();respond(404,['error'=>'Department not found']);}
  $stmt=$pdo->prepare('UPDATE departments SET name=? WHERE id=?');$stmt->execute([$name,$id]);
  $action='department.update';
 }
 $audit=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?)');
 $audit->execute([(int)$user['id'],$action,'department',(string)$id]);
 $pdo->commit();respond($action==='department.create'?201:200,['saved'=>true,'id'=>$id]);
} catch (Throwable $e) {
 if ($pdo->inTransaction())$pdo->rollBack();
 if ($e instanceof PDOException && (int)($e->errorInfo[1]??0)===1062) respond(409,['error'=>'Department code is already in use']);
 error_log('LEARN department save failed');respond(500,['error'=>'Could not save department']);
}
