<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('POST');
assertSameOrigin();
verifyCsrf();
$body=jsonBody();
$username=trim((string)($body['username']??''));
$password=$body['password']??null;
if (strlen($username)<1 || strlen($username)>100 || !is_string($password) || strlen($password)<1 || strlen($password)>1024) respond(400,['error'=>'Invalid credentials']);
$pdo=database();
$ipHash=hash('sha256',(string)($_SERVER['REMOTE_ADDR']??'unknown'));
$cutoff=date('Y-m-d H:i:s',time()-900);
$check=$pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE attempted_at>=? AND (username=? OR ip_hash=?)');
$check->execute([$cutoff,$username,$ipHash]);
if ((int)$check->fetchColumn()>=8) respond(429,['error'=>'Too many attempts. Try later.']);
$stmt=$pdo->prepare('SELECT u.id,u.username,u.display_name,u.password_hash,u.role,u.zone_id,u.branch_id,u.department_id,u.active,d.code AS department_code FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.username=? LIMIT 1');
$stmt->execute([$username]);
$user=$stmt->fetch();
$valid=$user && (int)$user['active']===1 && password_verify($password,$user['password_hash']);
if (!$valid) {
 $insert=$pdo->prepare('INSERT INTO login_attempts(username,ip_hash) VALUES(?,?)');
 $insert->execute([$username,$ipHash]);
 usleep(200000);
 respond(401,['error'=>'Invalid credentials']);
}
session_regenerate_id(true);
$_SESSION=['user_id'=>(int)$user['id'],'role'=>$user['role'],'csrf_token'=>bin2hex(random_bytes(32))];
unset($user['password_hash']);
respond(200,['user'=>publicUser($user),'csrf_token'=>$_SESSION['csrf_token']]);
