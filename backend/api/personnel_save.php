<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/record_validation.php';
requestMethod('POST');assertSameOrigin();verifyCsrf();
$pdo=database();$user=authenticatedUser($pdo);
if ($user['role']!=='super_admin') respond(403,['error'=>'Only the super administrator may manage personnel']);
$body=jsonBody();
try {
 $name=recordText($body,'full_name',180);$title=recordText($body,'job_title',180);
 $branch=recordId($body,'branch_id');$department=recordId($body,'department_id');
 $status=$body['status']??null;
 if (!in_array($status,['active','inactive'],true)) throw new InvalidArgumentException('Invalid status');
 $id=array_key_exists('id',$body)?recordId($body,'id'):null;
 if ($id===null) {
  $code=recordCode($body);$kind=$body['kind']??null;
  if (!in_array($kind,['teacher','staff'],true)) throw new InvalidArgumentException('Invalid personnel kind');
 } else {$version=recordId($body,'version');}
} catch (InvalidArgumentException $e) {respond(400,['error'=>$e->getMessage()]);}
try {
 $pdo->beginTransaction();
 if ($id===null) {
  $stmt=$pdo->prepare('INSERT INTO personnel(code,full_name,kind,branch_id,department_id,job_title,status) VALUES(?,?,?,?,?,?,?)');
  $stmt->execute([$code,$name,$kind,$branch,$department,$title,$status]);
  $id=(int)$pdo->lastInsertId();$action='personnel.create';
 } else {
  $stmt=$pdo->prepare('SELECT version FROM personnel WHERE id=? FOR UPDATE');$stmt->execute([$id]);$row=$stmt->fetch();
  if (!$row) {$pdo->rollBack();respond(404,['error'=>'Personnel record not found']);}
  if ((int)$row['version']!==$version) {$pdo->rollBack();respond(409,['error'=>'This record changed. Close this form and refresh the directory before editing again.']);}
  $stmt=$pdo->prepare('UPDATE personnel SET full_name=?,branch_id=?,department_id=?,job_title=?,status=?,version=version+1 WHERE id=?');
  $stmt->execute([$name,$branch,$department,$title,$status,$id]);$action='personnel.update';
 }
 $audit=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?)');
 $audit->execute([(int)$user['id'],$action,'personnel',(string)$id]);
 $pdo->commit();respond($action==='personnel.create'?201:200,['saved'=>true,'id'=>$id]);
} catch (Throwable $e) {
 if ($pdo->inTransaction())$pdo->rollBack();
 if ($e instanceof PDOException) {
  $code=(int)($e->errorInfo[1]??0);
  if ($code===1062) respond(409,['error'=>'Personnel code is already in use']);
  if ($code===1452) respond(400,['error'=>'Select an existing branch and department']);
 }
 error_log('LEARN personnel save failed');respond(500,['error'=>'Could not save personnel record. Confirm migration 003 has been imported.']);
}
