<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$pdo=database();
$user=authenticatedUser($pdo);
$date=$_GET['date']??null;
if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)
 || !($parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date))
 || $parsed->format('Y-m-d')!==$date) respond(400,['error'=>'Use a valid attendance date in YYYY-MM-DD format']);
$where=['a.attendance_date=?'];$params=[$date];
switch ($user['role']) {
 case 'super_admin': break;
 case 'zone_admin':
  if (!$user['zone_id']) respond(403,['error'=>'Zone assignment required']);
  $where[]='b.zone_id=?';$params[]=(int)$user['zone_id'];break;
 case 'branch_admin':
  if (!$user['branch_id']) respond(403,['error'=>'Branch assignment required']);
  $where[]='s.branch_id=?';$params[]=(int)$user['branch_id'];break;
 default: respond(403,['error'=>'Attendance access denied']);
}
$sql='SELECT a.id,a.student_id,a.attendance_date,a.status,a.version,
 s.student_code,s.full_name,s.grade_level,s.branch_id,b.name AS branch_name
 FROM student_attendance a JOIN students s ON s.id=a.student_id
 JOIN branches b ON b.id=s.branch_id
 WHERE '.implode(' AND ',$where).' ORDER BY s.full_name,s.id LIMIT 1000';
try {
 $stmt=$pdo->prepare($sql);$stmt->execute($params);
 respond(200,['attendance'=>$stmt->fetchAll(),'date'=>$date,'limit'=>1000]);
} catch (PDOException $error) {
 error_log('LEARN attendance read failed');
 respond(503,['error'=>'Attendance unavailable. Confirm migration 005 is installed.']);
}
