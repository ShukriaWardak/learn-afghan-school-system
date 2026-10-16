<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('POST');
assertSameOrigin();
verifyCsrf();
$pdo=database();
$u=authenticatedUser($pdo);
// Until the per-operation permission matrix is approved, only super admins can edit branches.
if ($u['role']!=='super_admin') respond(403,['error'=>'Only the super administrator may edit branches']);
$body=jsonBody();
$id=$body['id']??null;
$zoneId=$body['zone_id']??null;
$name=$body['name']??null;
$status=$body['status']??null;
$location=$body['location']??null;
if (!is_int($id)||$id<1||!is_int($zoneId)||$zoneId<1
 || !is_string($name)||!is_string($status)
 || !array_key_exists('location',$body)||($location!==null&&!is_string($location))) {
 respond(400,['error'=>'Invalid branch fields']);
}
$name=trim($name);
$location=$location===null?null:trim($location);
if (!preg_match('/^.{1,180}$/us',$name)
 || ($location!==null && (strlen($location)>1000 || !preg_match('/^.{0,250}$/us',$location)))
 || !in_array($status,['pending','active','inactive'],true)) {
 respond(400,['error'=>'Invalid branch fields']);
}
if ($location==='') $location=null;
try {
 $pdo->beginTransaction();
 $row=$pdo->prepare('SELECT id,code,name,zone_id,location,status FROM branches WHERE id=? FOR UPDATE');
 $row->execute([$id]);
 $old=$row->fetch();
 if (!$old) { $pdo->rollBack();respond(404,['error'=>'Branch not found']); }
 $zone=$pdo->prepare('SELECT id FROM zones WHERE id=?');
 $zone->execute([$zoneId]);
 if (!$zone->fetchColumn()) { $pdo->rollBack();respond(400,['error'=>'Zone does not exist']); }
 $fields=['name'=>$name,'zone_id'=>$zoneId,'location'=>$location,'status'=>$status];
 $edit=$pdo->prepare('UPDATE branches SET name=?,zone_id=?,location=?,status=? WHERE id=?');
 $edit->execute([$name,$zoneId,$location,$status,$id]);
 $audit=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)');
 $audit->execute([(int)$u['id'],'branch.update','branch',(string)$id,
  json_encode(['before'=>['name'=>$old['name'],'zone_id'=>(int)$old['zone_id'],'location'=>$old['location'],'status'=>$old['status']],
   'after'=>$fields],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
 $pdo->commit();
 respond(200,['updated'=>true,'branch_id'=>$id]);
} catch (Throwable $e) {
 if ($pdo->inTransaction()) $pdo->rollBack();
 error_log('LEARN branch update failed: '.get_class($e));
 respond(500,['error'=>'Unable to save branch changes']);
}
