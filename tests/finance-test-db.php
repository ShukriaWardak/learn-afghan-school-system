<?php
// Return a connection only to the disposable integration fixture, never a local school DB.
if (PHP_SAPI!=='cli'||getenv('LEARN_INTEGRATION_TEST')!=='1'||!getenv('MYSQL_TEST_PASSWORD')) exit(1);
$c=require __DIR__.'/../backend/config.local.php';
if ($c['database']!=='learn_afghan'||$c['password']!==getenv('MYSQL_TEST_PASSWORD')) exit(1);
$p=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname=learn_afghan;charset=utf8mb4',$c['username'],$c['password'],[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$hash=$p->query("SELECT password_hash FROM users WHERE username='test_super'")->fetchColumn();
if (!$hash||!password_verify('Disposable-test-password-2026',$hash)) exit(1);
return $p;
