<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
ini_set('display_errors', '0');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off','httponly'=>true,'samesite'=>'Strict']);
session_start();
function respond(int $status,array $body): never {http_response_code($status);echo json_encode($body,JSON_UNESCAPED_UNICODE);exit;}
function database(): PDO {
 $file=__DIR__.'/config.local.php';
 if (!is_file($file)) respond(503,['error'=>'Database is not configured.']);
 $c=require $file;
 foreach (['host','port','database','username','password'] as $key) if (!isset($c[$key])) respond(503,['error'=>'Incomplete database configuration.']);
 try {return new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname='.$c['database'].';charset=utf8mb4',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);}
 catch (PDOException $e) {error_log('LEARN DB unavailable');respond(503,['error'=>'Database temporarily unavailable.']);}
}
function userSession(): array {
 if (empty($_SESSION['user_id']) || empty($_SESSION['role'])) respond(401,['error'=>'Authentication required.']);
 return ['role'=>$_SESSION['role'],'zone_id'=>$_SESSION['zone_id']??null,'branch_id'=>$_SESSION['branch_id']??null];
}
