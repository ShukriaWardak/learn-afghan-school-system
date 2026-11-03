<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/record_validation.php';
requestMethod('POST');assertSameOrigin();verifyCsrf();
$pdo=database();$user=authenticatedUser($pdo);
if ($user['role']!=='super_admin') respond(403,['error'=>'Only a super administrator may record attendance']);
$body=jsonBody();
try {
 $studentId=recordId($body,'student_id');
 $date=$body['attendance_date']??null;
 if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)
  || !($parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date))
  || $parsed->format('Y-m-d')!==$date) throw new InvalidArgumentException('Invalid attendance date');
 $status=$body['status']??null;
 if (!in_array($status,['present','absent','late','excused'],true)) throw new InvalidArgumentException('Invalid attendance status');
 $id=array_key_exists('id',$body)?recordId($body,'id'):null;
 if ($id!==null) $version=recordId($body,'version');
} catch (InvalidArgumentException $error) {respond(400,['error'=>$error->getMessage()]);}
try {
 $pdo->beginTransaction();
 $student=$pdo->prepare('SELECT id,status FROM students WHERE id=? FOR UPDATE');
 $student->execute([$studentId]);$found=$student->fetch();
 if (!$found) {$pdo->rollBack();respond(400,['error'=>'Select an existing student']);}
 if ($id===null) {
  if ($found['status']!=='active') {$pdo->rollBack();respond(400,['error'=>'Attendance can be created only for active students']);}
  $stmt=$pdo->prepare('INSERT INTO student_attendance(student_id,attendance_date,status,recorded_by) VALUES(?,?,?,?)');
  $stmt->execute([$studentId,$date,$status,(int)$user['id']]);
  $id=(int)$pdo->lastInsertId();$action='attendance.create';
 } else {
  $stmt=$pdo->prepare('SELECT student_id,attendance_date,version FROM student_attendance WHERE id=? FOR UPDATE');
  $stmt->execute([$id]);$row=$stmt->fetch();
  if (!$row) {$pdo->rollBack();respond(404,['error'=>'Attendance record not found']);}
  if ((int)$row['student_id']!==$studentId || $row['attendance_date']!==$date) {
   $pdo->rollBack();respond(400,['error'=>'Student and date cannot be changed for an existing entry']);
  }
  if ((int)$row['version']!==$version) {$pdo->rollBack();respond(409,['error'=>'Attendance changed. Refresh before editing again.']);}
  $stmt=$pdo->prepare('UPDATE student_attendance SET status=?,version=version+1,recorded_by=? WHERE id=?');
  $stmt->execute([$status,(int)$user['id'],$id]);$action='attendance.update';
 }
 $audit=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?)');
 $audit->execute([(int)$user['id'],$action,'attendance',(string)$id]);
 $pdo->commit();respond($action==='attendance.create'?201:200,['saved'=>true,'id'=>$id]);
} catch (Throwable $error) {
 if ($pdo->inTransaction()) $pdo->rollBack();
 if ($error instanceof PDOException) {
  $code=(int)($error->errorInfo[1]??0);
  if ($code===1062) respond(409,['error'=>'Attendance for this student and date already exists']);
  if ($code===1452) respond(400,['error'=>'Select an existing student']);
 }
 error_log('LEARN attendance write failed');
 respond(500,['error'=>'Could not save attendance. Verify migration 005 and database permissions.']);
}
