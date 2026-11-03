<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/record_validation.php';
requestMethod('POST');assertSameOrigin();verifyCsrf();
$pdo=database();$user=authenticatedUser($pdo);
if ($user['role']!=='super_admin') respond(403,['error'=>'Only the super administrator can manage personnel attendance']);
$body=jsonBody();
try {
 $personnelId=recordId($body,'personnel_id');
 $date=$body['attendance_date']??null;
 if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)
  || !($parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date))
  || $parsed->format('Y-m-d')!==$date) throw new InvalidArgumentException('Invalid attendance date');
 $kind=$body['kind']??null;
 if (!in_array($kind,['teacher','staff'],true)) throw new InvalidArgumentException('Invalid personnel kind');
 $status=$body['status']??null;
 if (!in_array($status,['present','absent','late','excused'],true)) throw new InvalidArgumentException('Invalid attendance status');
 $id=array_key_exists('id',$body)?recordId($body,'id'):null;
 if ($id!==null) $version=recordId($body,'version');
} catch (InvalidArgumentException $error) {
 respond(400,['error'=>$error->getMessage()]);
}
try {
 $pdo->beginTransaction();
 $person=$pdo->prepare('SELECT id,kind,status FROM personnel WHERE id=? FOR UPDATE');
 $person->execute([$personnelId]);$found=$person->fetch();
 if (!$found || $found['kind']!==$kind) {
  $pdo->rollBack();respond(400,['error'=>'Select an existing person of the chosen type']);
 }
 if ($id===null) {
  if ($found['status']!=='active') {
   $pdo->rollBack();respond(400,['error'=>'Attendance can be created only for active personnel']);
  }
  $stmt=$pdo->prepare('INSERT INTO personnel_attendance(personnel_id,attendance_date,status,recorded_by) VALUES(?,?,?,?)');
  $stmt->execute([$personnelId,$date,$status,(int)$user['id']]);
  $id=(int)$pdo->lastInsertId();$action='personnel_attendance.create';
 } else {
  $stmt=$pdo->prepare('SELECT personnel_id,attendance_date,version FROM personnel_attendance WHERE id=? FOR UPDATE');
  $stmt->execute([$id]);$row=$stmt->fetch();
  if (!$row) {$pdo->rollBack();respond(404,['error'=>'Attendance entry not found']);}
  if ((int)$row['personnel_id']!==$personnelId || $row['attendance_date']!==$date) {
   $pdo->rollBack();respond(400,['error'=>'Person and date cannot change when editing attendance']);
  }
  if ((int)$row['version']!==$version) {
   $pdo->rollBack();respond(409,['error'=>'Attendance was changed by another user. Refresh and try again.']);
  }
  $stmt=$pdo->prepare('UPDATE personnel_attendance SET status=?,version=version+1,recorded_by=? WHERE id=?');
  $stmt->execute([$status,(int)$user['id'],$id]);$action='personnel_attendance.update';
 }
 $audit=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?)');
 $audit->execute([(int)$user['id'],$action,'personnel_attendance',(string)$id]);
 $pdo->commit();
 respond($action==='personnel_attendance.create'?201:200,['saved'=>true,'id'=>$id]);
} catch (Throwable $error) {
 if ($pdo->inTransaction()) $pdo->rollBack();
 if ($error instanceof PDOException) {
  $code=(int)($error->errorInfo[1]??0);
  if ($code===1062) respond(409,['error'=>'Attendance for this person and date already exists']);
  if ($code===1452) respond(400,['error'=>'Select an existing personnel record']);
 }
 error_log('LEARN personnel attendance write failed');
 respond(500,['error'=>'Could not save personnel attendance. Verify migration 006 and database permissions.']);
}
