<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

function requestMethod(string $method): void {
 if ($_SERVER['REQUEST_METHOD'] !== $method) {header('Allow: '.$method);respond(405,['error'=>'Method not allowed']);}
}
function assertSameOrigin(): void {
 $host = strtolower(explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0]);
 if ($host === '') respond(403,['error'=>'Invalid host']);
 $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
 $referer = (string)($_SERVER['HTTP_REFERER'] ?? '');
 if ($origin !== '') {
   $originHost = parse_url($origin, PHP_URL_HOST);
   if (!is_string($originHost) || strtolower($originHost)!==$host) respond(403,['error'=>'Invalid origin']);
 } elseif ($referer !== '') {
   $refererHost = parse_url($referer, PHP_URL_HOST);
   if (!is_string($refererHost) || strtolower($refererHost)!==$host) respond(403,['error'=>'Invalid referer']);
 }
}
function jsonBody(): array {
 if (!str_starts_with(strtolower((string)($_SERVER['CONTENT_TYPE'] ?? '')), 'application/json')) respond(415,['error'=>'JSON required']);
 $body = file_get_contents('php://input', false, null, 0, 8193);
 if ($body === false || strlen($body)>8192) respond(413,['error'=>'Request too large']);
 try {$data=json_decode($body,true,32,JSON_THROW_ON_ERROR);}
 catch (JsonException $e) {respond(400,['error'=>'Malformed JSON']);}
 if (!is_array($data) || array_is_list($data)) respond(400,['error'=>'JSON object required']);
 return $data;
}
function csrfToken(): string {
 if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token']=bin2hex(random_bytes(32));
 return (string)$_SESSION['csrf_token'];
}
function verifyCsrf(): void {
 $sent=(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'');
 if ($sent === '' || !hash_equals(csrfToken(),$sent)) respond(403,['error'=>'Invalid CSRF token']);
}
function authenticatedUser(PDO $pdo): array {
 $uid=$_SESSION['user_id']??null;
 if (!is_int($uid) || $uid<1) respond(401,['error'=>'Authentication required']);
 $stmt=$pdo->prepare('SELECT id,username,display_name,role,zone_id,branch_id,department_id,active FROM users WHERE id=? LIMIT 1');
 $stmt->execute([$uid]);$user=$stmt->fetch();
 if (!$user || (int)$user['active']!==1) {$_SESSION=[];respond(401,['error'=>'Authentication required']);}
 if ($user['role'] !== ($_SESSION['role']??null)) {$_SESSION=[];respond(401,['error'=>'Session expired']);}
 return $user;
}
function publicUser(array $u): array {
 return ['id'=>(int)$u['id'],'username'=>$u['username'],'display_name'=>$u['display_name'],'role'=>$u['role'],'zone_id'=>$u['zone_id']===null?null:(int)$u['zone_id'],'branch_id'=>$u['branch_id']===null?null:(int)$u['branch_id']];
}
