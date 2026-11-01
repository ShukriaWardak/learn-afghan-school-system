<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/record_validation.php';
requestMethod('POST'); assertSameOrigin(); verifyCsrf();
$pdo=database(); $user=authenticatedUser($pdo);
if ($user['role']!=='super_admin') respond(403,['error'=>'Only the super administrator may manage students']);
$body=jsonBody();
try {
 $name=recordText($body,'full_name',180);
 $grade=recordText($body,'grade_level',40);
 $branch=recordId($body,'branch_id');
 $status=$body['status']??null;
 if (!in_array($status,['active','inactive','graduated'],true)) throw new InvalidArgumentException('Invalid status');
 $id=array_key_exists('id',$body)?recordId($body,'id'):null;
 if ($id===null) $code=recordCode(['code'=>$body['student_code']??null]);
 else $version=recordId($body,'version');
} catch (InvalidArgumentException $e) {respond(400,['error'=>$e->getMessage()]);}
try {
 $pdo->beginTransaction();
 if ($id===null) {
  $stmt=$pdo->prepare('INSERT INTO students(student_code,full_name,branch_id,grade_level,status) VALUES(?,?,?,?,?)');
  $stmt->execute([$code,$name,$branch,$grade,$status]);
  $id=(int)$pdo->lastInsertId(); $action='student.create';
 } else {
  $stmt=$pdo->prepare('SELECT version FROM students WHERE id=? FOR UPDATE');
  $stmt->execute([$id]); $row=$stmt->fetch();
  if (!$row) {$pdo->rollBack();respond(404,['error'=>'Student record not found']);}
  if ((int)$row['version']!==$version) {$pdo->rollBack();respond(409,['error'=>'Student record changed. Refresh and try again.']);}
  $stmt=$pdo->prepare('UPDATE students SET full_name=?,branch_id=?,grade_level=?,status=?,version=version+1 WHERE id=?');
  $stmt->execute([$name,$branch,$grade,$status,$id]); $action='student.update';
 }
 $audit=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?)');
 $audit->execute([(int)$user['id'],$action,'student',(string)$id]);
 $pdo->commit();
 respond($action==='student.create'?201:200,['saved'=>true,'id'=>$id]);
} catch (Throwable $e) {
 if ($pdo->inTransaction()) $pdo->rollBack();
 if ($e instanceof PDOException) {
  $errorCode=(int)($e->errorInfo[1]??0);
  if ($errorCode===1062) respond(409,['error'=>'Student code already exists']);
  if ($errorCode===1452) respond(400,['error'=>'Select an existing branch']);
 }
 error_log('LEARN student save failed');
 respond(500,['error'=>'Could not save student record. Verify migration 004 is installed.']);
}
