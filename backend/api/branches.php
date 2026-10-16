<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$pdo=database();
$u=authenticatedUser($pdo);
$query="SELECT b.id,b.code,b.name,b.location,b.status,b.zone_id,
 z.code AS zone_code,z.name AS zone_name,
 (SELECT display_name FROM users a WHERE a.role='branch_admin' AND a.active=1
  AND a.branch_id=b.id ORDER BY a.id LIMIT 1) AS admin_name
 FROM branches b JOIN zones z ON z.id=b.zone_id";
switch ($u['role']) {
 case 'super_admin': $stmt=$pdo->query($query.' ORDER BY z.code,b.code');break;
 case 'zone_admin':
  if (!$u['zone_id']) respond(403,['error'=>'Zone assignment required']);
  $stmt=$pdo->prepare($query.' WHERE b.zone_id=? ORDER BY b.code');
  $stmt->execute([(int)$u['zone_id']]);break;
 case 'branch_admin':
  if (!$u['branch_id']) respond(403,['error'=>'Branch assignment required']);
  $stmt=$pdo->prepare($query.' WHERE b.id=? LIMIT 1');
  $stmt->execute([(int)$u['branch_id']]);break;
 default: respond(403,['error'=>'Branch directory access denied']);
}
respond(200,['branches'=>$stmt->fetchAll()]);
