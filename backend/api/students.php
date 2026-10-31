<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$pdo=database(); $user=authenticatedUser($pdo);
$where=[]; $params=[];
switch ($user['role']) {
 case 'super_admin': break;
 case 'zone_admin':
  if (!$user['zone_id']) respond(403,['error'=>'Zone assignment required']);
  $where[]='b.zone_id=?'; $params[]=(int)$user['zone_id']; break;
 case 'branch_admin':
  if (!$user['branch_id']) respond(403,['error'=>'Branch assignment required']);
  $where[]='s.branch_id=?'; $params[]=(int)$user['branch_id']; break;
 default: respond(403,['error'=>'Student directory access denied']);
}
$sql='SELECT s.id,s.student_code,s.full_name,s.branch_id,s.grade_level,s.status,s.version,b.name AS branch_name FROM students s JOIN branches b ON b.id=s.branch_id';
if ($where) $sql.=' WHERE '.implode(' AND ',$where);
$sql.=' ORDER BY s.full_name,s.id LIMIT 1000';
try {
 $stmt=$pdo->prepare($sql); $stmt->execute($params);
 respond(200,['students'=>$stmt->fetchAll(),'limit'=>1000]);
} catch (PDOException $e) {
 error_log('LEARN student directory unavailable');
 respond(503,['error'=>'Student directory unavailable. Verify database migration 004 is installed.']);
}

