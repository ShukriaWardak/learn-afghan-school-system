<?php
$pdo=require __DIR__.'/finance-test-db.php';
$pdo->exec("INSERT INTO departments(code,name) VALUES('FINANCE','Disposable Finance Test Department')");
$department=(int)$pdo->lastInsertId();
$insert=$pdo->prepare("INSERT INTO users(username,display_name,password_hash,role,department_id) VALUES(?,?,?,'department_user',?)");
for ($i=1;$i<=5;$i++) $insert->execute(['test_finance_'.$i,'Disposable Finance '.$i,password_hash('Disposable-test-password-2026',PASSWORD_DEFAULT),$department]);
echo "Five synthetic finance accounts prepared in the disposable test database.\n";
