<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/bootstrap.php';
if ($_SERVER['REQUEST_METHOD']!=='GET') {header('Allow: GET');respond(405,['error'=>'Method not allowed']);}
$u=userSession();$db=database();
$query='SELECT b.id,b.code,b.name,b.location,b.status,z.code AS zone_code,z.name AS zone_name FROM branches b JOIN zones z ON z.id=b.zone_id';
if ($u['role']==='super_admin') {$stmt=$db->query($query.' ORDER BY z.code,b.code');}
elseif ($u['role']==='zone_admin' && $u['zone_id']) {$stmt=$db->prepare($query.' WHERE b.zone_id=? ORDER BY b.code');$stmt->execute([(int)$u['zone_id']]);}
elseif ($u['role']==='branch_admin' && $u['branch_id']) {$stmt=$db->prepare($query.' WHERE b.id=? LIMIT 1');$stmt->execute([(int)$u['branch_id']]);}
else respond(403,['error'=>'Branch directory access denied']);
respond(200,['branches'=>$stmt->fetchAll()]);
