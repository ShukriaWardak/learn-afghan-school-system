<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$pdo=database();$user=authenticatedUser($pdo);
$kind=$_GET['kind']??null;
if (!in_array($kind,['teacher','staff'],true)) respond(400,['error'=>'Invalid personnel kind']);
$where=['p.kind=?'];$params=[$kind];
switch ($user['role']) {
 case 'super_admin':break;
 case 'zone_admin':
  if (!$user['zone_id']) respond(403,['error'=>'Zone assignment required']);
  $where[]='b.zone_id=?';$params[]=(int)$user['zone_id'];break;
 case 'branch_admin':
  if (!$user['branch_id']) respond(403,['error'=>'Branch assignment required']);
  $where[]='p.branch_id=?';$params[]=(int)$user['branch_id'];break;
 default:respond(403,['error'=>'Personnel directory access denied']);
}
$stmt=$pdo->prepare('SELECT p.id,p.code,p.full_name,p.kind,p.branch_id,p.department_id,p.job_title,p.status,p.version,b.name AS branch_name,d.name AS department_name FROM personnel p JOIN branches b ON b.id=p.branch_id JOIN departments d ON d.id=p.department_id WHERE '.implode(' AND ',$where).' ORDER BY p.full_name,p.id LIMIT 1000');
$stmt->execute($params);
respond(200,['personnel'=>$stmt->fetchAll(),'limit'=>1000]);
