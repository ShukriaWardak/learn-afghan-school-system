<?php
declare(strict_types=1);
// Local owner enrollment only; no HTTP account-creation route.
if (PHP_SAPI !== 'cli') {http_response_code(404);exit;}
ini_set('display_errors','0');
if (PHP_VERSION_ID < 80100) {fwrite(STDERR,"Use PHP 8.1 or newer.\n");exit(1);}
if (!class_exists('PDO') || !in_array('mysql',PDO::getAvailableDrivers(),true)) {
    fwrite(STDERR,"Enable PDO MySQL in this PHP executable.\n");exit(1);
}
$username=getenv('LEARN_FIRST_ADMIN_USERNAME');
$name=getenv('LEARN_FIRST_ADMIN_NAME');
$password=getenv('LEARN_FIRST_ADMIN_PASSWORD');
if (!is_string($username) || !preg_match('/^[A-Za-z0-9_.-]{3,100}$/D',$username)
    || !is_string($name) || !preg_match('/^.{1,180}$/us',trim($name))
    || !is_string($password) || strlen($password)<12 || strlen($password)>72) {
    fwrite(STDERR,"Provide LEARN_FIRST_ADMIN_USERNAME, LEARN_FIRST_ADMIN_NAME and LEARN_FIRST_ADMIN_PASSWORD (12-72 bytes).\n");exit(1);
}
try {
    // Optional explicit config path lets a local launcher use the existing project.
    $file=getenv('LEARN_FIRST_ADMIN_CONFIG') ?: dirname(__DIR__).'/config.local.php';
    if (!is_file($file) || !is_readable($file)) throw new RuntimeException();
    ob_start();
    try {$config=require $file;}
    finally {ob_end_clean();}
    if (!is_array($config)) throw new RuntimeException();
    foreach (['host','database','username','password'] as $key) {
        if (!isset($config[$key]) || !is_string($config[$key])) throw new RuntimeException();
    }
    if (!isset($config['port']) || !is_scalar($config['port'])
        || !preg_match('/^[0-9]+$/D',(string)$config['port'])
        || (int)$config['port']<1 || (int)$config['port']>65535) throw new RuntimeException();
    $pdo=new PDO('mysql:host='.$config['host'].';port='.$config['port'].';dbname='.$config['database'].';charset=utf8mb4',
        $config['username'],$config['password'],[
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES=>false,
            PDO::ATTR_TIMEOUT=>3,
        ]);
} catch (Throwable $error) {
    fwrite(STDERR,"Could not read the local database configuration or connect to MySQL. Start XAMPP MySQL and check backend/config.local.php. No account created.\n");exit(1);
}
$locked=false;$status=1;$message='';
try {
    $locked=(int)$pdo->query('SELECT GET_LOCK("learn_first_admin_bootstrap",10)')->fetchColumn()===1;
    if (!$locked) throw new RuntimeException('Another first-admin setup is running. Try again after it finishes.');
    // Begin after acquiring the lock, so the existing-account check sees commits.
    $pdo->beginTransaction();
    $count=(int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='super_admin'")->fetchColumn();
    $query=$pdo->prepare('SELECT id,role,active,password_hash FROM users WHERE username=? LIMIT 1 FOR UPDATE');
    $query->execute([$username]);$existing=$query->fetch();
    if ($count>0) {
        if ($existing && $existing['role']==='super_admin' && (int)$existing['active']===1
            && password_verify($password,$existing['password_hash'])) {
            $pdo->rollBack();$status=0;
            $message='Super administrator is already ready with the supplied credentials. No account changed.';
        } else {
            throw new RuntimeException('A super administrator already exists. No account created or password changed. Use reset-local-login.php --list to identify the existing account.');
        }
    } else {
        if ($existing) throw new RuntimeException('This username is already in use. Choose a different username. No account changed.');
        $hash=password_hash($password,PASSWORD_DEFAULT);
        $insert=$pdo->prepare("INSERT INTO users(username,display_name,password_hash,role,active) VALUES(?,?,?,'super_admin',1)");
        $insert->execute([$username,trim($name),$hash]);
        $id=(string)$pdo->lastInsertId();
        $audit=$pdo->prepare("INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,details_json) VALUES(NULL,'first_admin_created_cli','user',?,?)");
        $audit->execute([$id,json_encode(['source'=>'local_cli'],JSON_THROW_ON_ERROR)]);
        $pdo->commit();$status=0;
        $message='First super administrator created. Clear bootstrap environment variables now.';
    }
} catch (PDOException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $number=(int)($error->errorInfo[1]??0);
    $message=in_array($number,[1146,1054],true)
        ? 'Required database tables or columns are missing. Open check-setup.php to check the schema. No account created.'
        : 'Account creation failed. Check users/audit_events, username uniqueness and database write permissions. No account created.';
} catch (RuntimeException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $message=$error->getMessage();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $message='Account creation failed. No account created.';
} finally {
    if ($locked) {
        try {$pdo->query('SELECT RELEASE_LOCK("learn_first_admin_bootstrap")');}
        catch (Throwable $error) {/* Closing the connection also releases its lock. */}
    }
}
fwrite($status===0 ? STDOUT : STDERR,$message.PHP_EOL);
exit($status);

