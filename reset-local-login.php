<?php
declare(strict_types=1);
// Local owner recovery only. This file never accepts browser requests.
if (PHP_SAPI !== 'cli') {http_response_code(404);exit;}
ini_set('display_errors', '0');
if (PHP_VERSION_ID < 80100) {fwrite(STDERR,"Use XAMPP's PHP 8.1 or newer.\n");exit(1);}
if (!class_exists('PDO') || !in_array('mysql', PDO::getAvailableDrivers(), true)) {
    fwrite(STDERR,"Enable PDO MySQL in the PHP executable used for this command.\n");exit(1);
}
$list = ($argc === 2 && $argv[1] === '--list');
if (!$list && $argc !== 1) {
    fwrite(STDERR,"Usage: php reset-local-login.php [--list]\n");exit(1);
}
$username = trim((string) getenv('LEARN_RESET_USERNAME'));
$password = getenv('LEARN_RESET_PASSWORD');
if (!$list && ($username === '' || strlen($username) > 100
    || !is_string($password) || strlen($password) < 12 || strlen($password) > 72)) {
    fwrite(STDERR,"Set LEARN_RESET_USERNAME to an existing account and LEARN_RESET_PASSWORD to a new password (12-72 bytes).\n");exit(1);
}
$pdo = null;
try {
    $file = __DIR__.'/backend/config.local.php';
    if (!is_file($file) || !is_readable($file)) throw new RuntimeException();
    ob_start();
    try {$config = require $file;}
    finally {ob_end_clean();}
    if (!is_array($config)) throw new RuntimeException();
    foreach (['host','database','username','password'] as $key) {
        if (!isset($config[$key]) || !is_string($config[$key])) throw new RuntimeException();
    }
    if (!isset($config['port']) || !is_scalar($config['port'])
        || !preg_match('/^[0-9]+$/D',(string)$config['port'])
        || (int)$config['port'] < 1 || (int)$config['port'] > 65535) throw new RuntimeException();
    $pdo = new PDO('mysql:host='.$config['host'].';port='.$config['port'].';dbname='.$config['database'].';charset=utf8mb4',
        $config['username'],$config['password'],[
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES=>false,
            PDO::ATTR_TIMEOUT=>3,
        ]);
} catch (Throwable $error) {
    fwrite(STDERR,"Could not load backend/config.local.php or connect to its database. Check local setup; no password changed.\n");exit(1);
}
try {
    if ($list) {
        $rows = $pdo->query('SELECT username,role,active FROM users ORDER BY username LIMIT 201')->fetchAll();
        if (!$rows) {fwrite(STDOUT,"No website accounts exist. Use backend/cli/first_admin.php for first-account setup.\n");exit;}
        fwrite(STDOUT,"Website username | Role | Status\n");
        foreach (array_slice($rows,0,200) as $row) {
            // JSON escaping keeps unusual usernames from controlling terminal output.
            fwrite(STDOUT,json_encode($row['username'],JSON_UNESCAPED_UNICODE).' | '.$row['role'].' | '.((int)$row['active'] === 1 ? 'active' : 'inactive')."\n");
        }
        if (count($rows) > 200) fwrite(STDOUT,"Showing the first 200 accounts.\n");
        exit;
    }
    $pdo->beginTransaction();
    $query = $pdo->prepare('SELECT id,active FROM users WHERE username=? LIMIT 1 FOR UPDATE');
    $query->execute([$username]);
    $user = $query->fetch();
    if (!$user) {
        $pdo->rollBack();fwrite(STDERR,"No account matches that username. Run --list to check website usernames. No password changed.\n");exit(1);
    }
    if ((int)$user['active'] !== 1) {
        $pdo->rollBack();fwrite(STDERR,"This account is inactive. Ask the database owner to review its status. No password changed.\n");exit(1);
    }
    $hash = password_hash($password,PASSWORD_DEFAULT);
    $update = $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?');
    $update->execute([$hash,$user['id']]);
    $audit = $pdo->prepare("INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,details_json) VALUES(NULL,'password_reset_local_cli','user',?,?)");
    $audit->execute([(string)$user['id'],json_encode(['source'=>'local_cli'],JSON_THROW_ON_ERROR)]);
    $pdo->commit();
    fwrite(STDOUT,"Password reset for the selected account. Sign in with its existing username and the new password.\n");
    fwrite(STDOUT,"If login says Too many attempts, wait 15 minutes before trying again. Clear the reset environment variables now.\n");
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR,"Password reset failed; no password changed. Check the users/audit_events tables and database write permissions.\n");exit(1);
}
