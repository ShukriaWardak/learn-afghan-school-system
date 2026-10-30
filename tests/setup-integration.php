<?php
// Disposable CI database only; never run against a working installation.
if (PHP_SAPI !== 'cli' || getenv('LEARN_INTEGRATION_TEST') !== '1') exit(1);
$config=['host'=>'127.0.0.1','port'=>'3306','database'=>'learn_afghan','username'=>'root','password'=>getenv('MYSQL_TEST_PASSWORD')];
$pdo=new PDO('mysql:host=127.0.0.1;port=3306;charset=utf8mb4','root',$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
if ($pdo->query("SHOW DATABASES LIKE 'learn_afghan'")->fetchColumn()) {fwrite(STDERR,"Refusing non-empty test installation\n");exit(1);}
foreach (['schema.sql','002_login_attempts.sql','003_personnel.sql'] as $file) $pdo->exec(file_get_contents(__DIR__.'/../database/'.$file));
$pdo->exec("INSERT INTO zones(code,name) VALUES('TEST_N','Test North'),('TEST_S','Test South')");
$pdo->exec("INSERT INTO branches(zone_id,code,name) VALUES(1,'TEST_B1','Test Branch One'),(2,'TEST_B2','Test Branch Two')");
$stmt=$pdo->prepare('INSERT INTO users(username,display_name,password_hash,role,zone_id,branch_id) VALUES(?,?,?,?,?,?)');
foreach ([['test_super','super_admin',null,null],['test_zone','zone_admin',1,null],['test_branch','branch_admin',null,1],['test_department','department_user',null,null]] as [$name,$role,$zone,$branch]) $stmt->execute([$name,$name,password_hash('Disposable-test-password-2026',PASSWORD_DEFAULT),$role,$zone,$branch]);
file_put_contents(__DIR__.'/../backend/config.local.php',"<?php\nreturn ".var_export($config,true).";\n");
echo "Disposable integration fixtures ready\n";
