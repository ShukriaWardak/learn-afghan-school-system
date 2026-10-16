<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('POST');assertSameOrigin();verifyCsrf();
$pdo=database();$user=authenticatedUser($pdo);
if ($user['role']!=='super_admin') respond(403,['error'=>'Only the super administrator may create branches']);
$body=jsonBody();
$code=$body['code']??null;$name=$body['name']??null;
$zoneId=$body['zone_id']??null;$location=$body['location']??null;
if (!is_string($code)||!is_string($name)||!is_int($zoneId)||$zoneId<1
 ||($location!==null&&!is_string($location)))respond(400,['error'=>'Invalid branch fields']);
$code=strtoupper(trim($code));$name=trim($name);
$location=$location===null?null:trim($location);if($location==='')$location=null;
if (!preg_match('/^[A-Z0-9][A-Z0-9_-]{1,29}$/',$code)
 ||!preg_match('/^.{1,180}$/us',$name)
 ||($location!==null && !preg_match('/^.{0,250}$/us',$location)))
 respond(400,['error'=>'Invalid branch code, name or location']);
try {
 $pdo->beginTransaction();
 $zone=$pdo->prepare('SELECT id FROM zones WHERE id=?');$zone->execute([$zoneId]);
 if (!$zone->fetchColumn()) {$pdo->rollBack();respond(400,['error'=>'Zone does not exist']);}
 $stmt=$pdo->prepare("INSERT INTO branches(zone_id,code,name,location,status) VALUES(?,?,?,?,'pending')");
 $stmt->execute([$zoneId,$code,$name,$location]);$id=(int)$pdo->lastInsertId();
 $audit=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)');
 $audit->execute([(int)$user['id'],'branch.create','branch',(string)$id,
  json_encode(['code'=>$code,'name'=>$name,'zone_id'=>$zoneId,'location'=>$location],
    JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
 $pdo->commit();respond(201,['created'=>true,'id'=>$id]);
} catch (PDOException $e) {
 if ($pdo->inTransaction())$pdo->rollBack();
 if ($e->getCode()==='23000')respond(409,['error'=>'Branch code is already in use']);
 error_log('LEARN branch create database error');respond(500,['error'=>'Could not create branch']);
} catch (Throwable $e) {
 if ($pdo->inTransaction())$pdo->rollBack();
 error_log('LEARN branch create failed');respond(500,['error'=>'Could not create branch']);
}
