<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$pdo=database();
$u=authenticatedUser($pdo);
switch ($u['role']) {
 case 'super_admin':
  $stmt=$pdo->query('SELECT id,code,name FROM zones ORDER BY code');
  break;
 case 'zone_admin':
  if (!$u['zone_id']) respond(403,['error'=>'Zone assignment required']);
  $stmt=$pdo->prepare('SELECT id,code,name FROM zones WHERE id=?');
  $stmt->execute([(int)$u['zone_id']]);
  break;
 case 'branch_admin':
  if (!$u['branch_id']) respond(403,['error'=>'Branch assignment required']);
  $stmt=$pdo->prepare('SELECT z.id,z.code,z.name FROM zones z JOIN branches b ON b.zone_id=z.id WHERE b.id=?');
  $stmt->execute([(int)$u['branch_id']]);
  break;
 default: respond(403,['error'=>'Zone directory access denied']);
}
respond(200,['zones'=>$stmt->fetchAll()]);
