<?php
declare(strict_types=1);
// CLI only: one-time approved first-account enrollment. Never expose this over HTTP.
if (PHP_SAPI!=='cli') {http_response_code(404);exit;}
require_once dirname(__DIR__).'/bootstrap.php';
$username=getenv('LEARN_FIRST_ADMIN_USERNAME');
$name=getenv('LEARN_FIRST_ADMIN_NAME');
$password=getenv('LEARN_FIRST_ADMIN_PASSWORD');
if (!is_string($username)||!preg_match('/^[A-Za-z0-9_.-]{3,100}$/',$username)
 || !is_string($name)||!preg_match('/^.{1,180}$/us',trim($name))
 || !is_string($password)||strlen($password)<12||strlen($password)>256) {
 fwrite(STDERR,"Provide LEARN_FIRST_ADMIN_USERNAME, LEARN_FIRST_ADMIN_NAME and a password (12-256 bytes) as local environment variables.\n");
 exit(1);
}
$pdo=database();
$count=(int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='super_admin'")->fetchColumn();
if ($count!==0) {fwrite(STDERR,"A super administrator already exists. No account created.\n");exit(1);}
try {
 $pdo->beginTransaction();
 // Prevent accidental repeated bootstrap under concurrent CLI executions.
 $pdo->query('SELECT GET_LOCK("learn_first_admin_bootstrap",10)');
 $count=(int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='super_admin'")->fetchColumn();
 if ($count!==0) { $pdo->rollBack();fwrite(STDERR,"A super administrator already exists.\n");exit(1); }
 $stmt=$pdo->prepare("INSERT INTO users(username,display_name,password_hash,role,active) VALUES(?,?,?,'super_admin',1)");
 $stmt->execute([$username,trim($name),password_hash($password,PASSWORD_DEFAULT)]);
 $pdo->commit();
 fwrite(STDOUT,"First super administrator created. Clear bootstrap environment variables now.\n");
} catch (Throwable $e) {
 if($pdo->inTransaction())$pdo->rollBack();
 fwrite(STDERR,"Account creation failed. Confirm username is unique and database permissions are configured.\n");
 exit(1);
} finally {
 $pdo->query('SELECT RELEASE_LOCK("learn_first_admin_bootstrap")');
}
