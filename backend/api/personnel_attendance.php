<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$pdo=database();
$user=authenticatedUser($pdo);
$date=$_GET['date']??null;
$kind=$_GET['kind']??null;
if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date)
 || !($parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date))
 || $parsed->format('Y-m-d')!==$date) respond(400,['error'=>'Use a valid date in YYYY-MM-DD format']);
if (!in_array($kind,['teacher','staff'],true)) respond(400,['error'=>'Choose teacher or staff attendance']);
$where=['a.attendance_date=?','p.kind=?'];$params=[$date,$kind];
switch ($user['role']) {
 case 'super_admin': break;
 case 'zone_admin':
  if (!$user['zone_id']) respond(403,['error'=>'Zone assignment required']);
  $where[]='b.zone_id=?';$params[]=(int)$user['zone_id'];break;
 case 'branch_admin':
  if (!$user['branch_id']) respond(403,['error'=>'Branch assignment required']);
  $where[]='p.branch_id=?';$params[]=(int)$user['branch_id'];break;
 default: respond(403,['error'=>'Personnel attendance access denied']);
}
$sql='SELECT a.id,a.personnel_id,a.attendance_date,a.status,a.version,
 p.code,p.full_name,p.kind,p.job_title,p.branch_id,b.name AS branch_name,
 p.department_id,d.name AS department_name
 FROM personnel_attendance a
 JOIN personnel p ON p.id=a.personnel_id
 JOIN branches b ON b.id=p.branch_id
 JOIN departments d ON d.id=p.department_id
 WHERE '.implode(' AND ',$where).' ORDER BY p.full_name,p.id LIMIT 1000';
try {
 $stmt=$pdo->prepare($sql);$stmt->execute($params);
 respond(200,['attendance'=>$stmt->fetchAll(),'date'=>$date,'kind'=>$kind,'limit'=>1000]);
} catch (PDOException $error) {
 error_log('LEARN personnel attendance read failed');
 respond(503,['error'=>'Personnel attendance unavailable. Verify migration 006 is installed.']);
}
