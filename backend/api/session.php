<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/bootstrap.php';
if ($_SERVER['REQUEST_METHOD']!=='GET') {header('Allow: GET');respond(405,['error'=>'Method not allowed']);}
$u=userSession();respond(200,['authenticated'=>true,'role'=>$u['role']]);
