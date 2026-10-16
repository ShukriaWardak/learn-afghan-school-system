<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('POST'); assertSameOrigin(); verifyCsrf();
$pdo=database();$user=authenticatedUser($pdo);
if ($user['role']!=='super_admin') respond(403,['error'=>'Only the super administrator may create zones']);
$body=jsonBody();
$code=$body['code']??null;$name=$body['name']??null;
if (!is_string($code)||!is_string($name)) respond(400,['error'=>'Code and name required']);
$code=strtoupper(trim($code));$name=trim($name);
if (!preg_match('/^[A-Z0-9][A-Z0-9_-]{1,29}$/',$code)||!preg_match('/^.{1,150}$/us',$name))
 respond(400,['error'=>'Invalid zone code or name']);
try {
 $pdo->beginTransaction();
 $stmt=$pdo->prepare('INSERT INTO zones(code,name) VALUES(?,?)');$stmt->execute([$code,$name]);
 $id=(int)$pdo->lastInsertId();
 $audit=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)');
 $audit->execute([(int)$user['id'],'zone.create','zone',(string)$id,
  json_encode(['code'=>$code,'name'=>$name],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
 $pdo->commit();respond(201,['created'=>true,'id'=>$id]);
} catch (PDOException $e) {
 if ($pdo->inTransaction())$pdo->rollBack();
 if ($e->getCode()==='23000')respond(409,['error'=>'Zone code is already in use']);
 error_log('LEARN zone create database error');respond(500,['error'=>'Could not create zone']);
} catch (Throwable $e) {
 if ($pdo->inTransaction())$pdo->rollBack();
 error_log('LEARN zone create failed');respond(500,['error'=>'Could not create zone']);
}
