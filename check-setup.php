<?php
// Read-only local setup diagnostics. Kept compatible with PHP 8.0 so an older
// XAMPP installation can display the project's PHP 8.1 requirement clearly.
declare(strict_types=1);

$cli = PHP_SAPI === 'cli';
if (!$cli) {
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    $address = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    $host = parse_url('http://'.(string) ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
    if (!in_array($address, ['127.0.0.1', '::1'], true)
        || !is_string($host)
        || !in_array(strtolower($host), ['localhost', '127.0.0.1', '[::1]'], true)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        exit('Setup checks are available from localhost only.');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        http_response_code(405);
        header('Allow: GET');
        exit('Use GET to view setup checks.');
    }
    header('Content-Type: text/html; charset=utf-8');
}

ini_set('display_errors', '0');
$checks = [];
$add = static function (string $id, string $title, string $status, string $detail) use (&$checks): void {
    $checks[] = ['id'=>$id, 'title'=>$title, 'status'=>$status, 'detail'=>$detail];
};
$add('php', 'PHP version', PHP_VERSION_ID >= 80100 ? 'pass' : 'fail',
    'Running PHP '.PHP_VERSION.'. This application requires PHP 8.1 or newer.');
$driver = class_exists('PDO') && in_array('mysql', PDO::getAvailableDrivers(), true);
$add('driver', 'PDO MySQL driver', $driver ? 'pass' : 'fail', $driver
    ? 'The PHP MySQL connection driver is available.'
    : 'Enable the pdo_mysql extension in the PHP configuration used by this server, then restart Apache.');

$configPath = __DIR__.'/backend/config.local.php';
$config = null;
if (!is_file($configPath)) {
    $add('config', 'Database configuration file', 'fail',
        'Missing backend/config.local.php. Put the file beside backend/bootstrap.php in the project folder shown above.');
} elseif (!is_readable($configPath)) {
    $add('config', 'Database configuration file', 'fail',
        'backend/config.local.php exists, but PHP cannot read it. Check its file permissions.');
} else {
    try {
        // Suppress accidental output from a malformed local configuration file.
        ob_start();
        try { $candidate = require $configPath; }
        finally { ob_end_clean(); }
        if (!is_array($candidate)) throw new RuntimeException('Invalid configuration');
        foreach (['host', 'database', 'username', 'password'] as $key) {
            if (!isset($candidate[$key]) || !is_string($candidate[$key])) throw new RuntimeException('Invalid configuration');
        }
        if (!isset($candidate['port']) || (!is_string($candidate['port']) && !is_int($candidate['port']))) throw new RuntimeException('Invalid configuration');
        if (trim((string) $candidate['host']) === '' || trim((string) $candidate['database']) === ''
            || trim((string) $candidate['username']) === '' || !preg_match('/^[0-9]+$/D', (string) $candidate['port'])
            || (int) $candidate['port'] < 1 || (int) $candidate['port'] > 65535) {
            throw new RuntimeException('Invalid configuration');
        }
        $config = $candidate;
        $add('config', 'Database configuration file', 'pass',
            'backend/config.local.php is present and contains the required settings. Credentials are not displayed.');
    } catch (Throwable $error) {
        $add('config', 'Database configuration file', 'fail',
            'The file could not be loaded as valid settings. Compare its syntax and host/port/database/username/password keys with backend/config.example.php.');
    }
}

$pdo = null;
if ($config !== null && $driver) {
    try {
        $pdo = new PDO('mysql:host='.$config['host'].';port='.$config['port'].';dbname='.$config['database'].';charset=utf8mb4',
            (string) $config['username'], (string) $config['password'], [
                PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES=>false,
                PDO::ATTR_TIMEOUT=>3,
            ]);
        $add('connection', 'Database connection', 'pass', 'Connected to the configured MySQL/MariaDB database.');
    } catch (PDOException $error) {
        $number = (int) ($error->errorInfo[1] ?? 0);
        $detail = $number === 1049 ? 'The configured database does not exist. Check the database name and import the project schema.'
            : ($number === 1045 ? 'MySQL rejected the account. Check the username/password in backend/config.local.php.'
            : 'Could not connect to MySQL/MariaDB. Check that it is running and that the configured host and port are correct.');
        $add('connection', 'Database connection', 'fail', $detail);
    }
} else {
    $add('connection', 'Database connection', 'waiting', 'Complete the configuration-file and PDO-driver checks first.');
}

$tables = [
    'zones'=>['schema.sql', ['id', 'code', 'name']],
    'branches'=>['schema.sql', ['id', 'zone_id', 'code', 'name', 'location', 'status', 'created_at', 'updated_at']],
    'departments'=>['schema.sql', ['id', 'code', 'name', 'parent_id']],
    'users'=>['schema.sql', ['id', 'username', 'display_name', 'password_hash', 'role', 'zone_id', 'branch_id', 'department_id', 'active', 'created_at']],
    'audit_events'=>['schema.sql', ['id', 'actor_user_id', 'action', 'entity_type', 'entity_id', 'details_json', 'created_at']],
    'login_attempts'=>['002_login_attempts.sql', ['id', 'username', 'ip_hash', 'attempted_at']],
    'personnel'=>['003_personnel.sql', ['id', 'code', 'full_name', 'kind', 'branch_id', 'department_id', 'job_title', 'status', 'version', 'created_at', 'updated_at']],
    'students'=>['004_students.sql', ['id', 'student_code', 'full_name', 'branch_id', 'grade_level', 'status', 'version', 'created_at', 'updated_at']],
    'student_attendance'=>['005_student_attendance.sql', ['id', 'student_id', 'attendance_date', 'status', 'version', 'recorded_by', 'created_at', 'updated_at']],
    'personnel_attendance'=>['006_personnel_attendance.sql', ['id', 'personnel_id', 'attendance_date', 'status', 'version', 'recorded_by', 'created_at', 'updated_at']],
];
$usersReady = false;
foreach ($tables as $name => [$migration, $required]) {
    if (!$pdo) {
        $add('table:'.$name, 'Table: '.$name, 'waiting', 'Connect to the database to inspect this table.');
        continue;
    }
    try {
        // Table names come only from the fixed list above, never from the request.
        $fields = $pdo->query('SHOW COLUMNS FROM `'.$name.'`')->fetchAll(PDO::FETCH_COLUMN);
        $missing = array_values(array_diff($required, $fields));
        if ($missing) {
            $add('table:'.$name, 'Table: '.$name, 'fail', 'Columns missing: '.implode(', ', $missing)
                .'. Compare Structure with database/'.$migration.' before updating this existing table.');
        } else {
            $add('table:'.$name, 'Table: '.$name, 'pass', 'The table and the columns used by the application are present.');
            if ($name === 'users') $usersReady = true;
        }
    } catch (PDOException $error) {
        $number = (int) ($error->errorInfo[1] ?? 0);
        $add('table:'.$name, 'Table: '.$name, 'fail', $number === 1146
            ? 'Table missing. Apply database/'.$migration.' in the documented migration order.'
            : 'The table could not be inspected. Check the application account permissions and this table in phpMyAdmin.');
    }
}
if ($pdo && $usersReady) {
    try {
        $row = $pdo->query("SELECT COUNT(*) AS total, COALESCE(SUM(active=1),0) AS active FROM users WHERE role='super_admin'")->fetch();
        if ((int) $row['active'] > 0) {
            $add('admin', 'Administrator account', 'pass',
                'An active super administrator exists. Sign in with that account; this check does not verify its password.');
        } elseif ((int) $row['total'] > 0) {
            $add('admin', 'Administrator account', 'fail',
                'Administrator records exist but none is active. Review the existing account with your administrator; first_admin.php does not replace existing accounts.');
        } else {
            $add('admin', 'Administrator account', 'fail',
                'The first administrator has not been created. Run backend/cli/first_admin.php from a terminal using the first-admin setup instructions.');
        }
    } catch (PDOException $error) {
        $add('admin', 'Administrator account', 'fail', 'The administrator account could not be checked. Review the users table permissions.');
    }
} else {
    $add('admin', 'Administrator account', 'waiting', 'Complete the database-connection and users-table checks first.');
}

$ready = count(array_filter($checks, static fn (array $item): bool => $item['status'] !== 'pass')) === 0;
if ($cli) {
    echo json_encode(['project_folder'=>__DIR__, 'ready'=>$ready, 'checks'=>$checks], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE).PHP_EOL;
    exit;
}
$escape = static fn (string $text): string => htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LEARN Afghan | Local setup checks</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#edf3fb;color:#173456;font:16px/1.55 "Segoe UI",Arial,sans-serif}main{max-width:1000px;margin:36px auto;padding:0 20px}header{background:#102f5a;color:white;border-radius:16px;padding:28px}h1{margin:6px 0;font-size:28px}.eyebrow{font-size:12px;letter-spacing:1.8px}header p{margin:8px 0 0;color:#e3efff}.summary,.folder{background:white;border:1px solid #cbdced;border-radius:12px;padding:18px;margin:18px 0}.folder code{overflow-wrap:anywhere}a{color:#14579b;font-weight:700}.checks{display:grid;grid-template-columns:1fr 1fr;gap:12px}.check{background:white;border:1px solid #cbdced;border-left:5px solid #3974b3;border-radius:12px;padding:18px}.check h2{font-size:17px;margin:10px 0 5px}.check p{font-size:14px;margin:0;color:#405b77}.check.fail{border-left-color:#af2441}.check.pass{border-left-color:#176d53}.badge{font-size:11px;font-weight:800;letter-spacing:1px;color:#215b8f}.pass .badge{color:#176d53}.fail .badge{color:#af2441}footer{margin:20px 0;color:#50647c;font-size:13px}@media(max-width:650px){main{margin:16px auto}.checks{grid-template-columns:1fr}h1{font-size:24px}}
</style>
</head>
<body><main>
<header><span class="eyebrow">LEARN AFGHAN · LOCAL DEVELOPMENT</span><h1>Check your setup</h1><p>See the setup steps needed to open your connected dashboard.</p></header>
<section class="folder"><strong>Project folder being served</strong><br><code><?= $escape(__DIR__) ?></code></section>
<section class="summary"><strong><?= $ready ? 'Basic setup checks passed' : 'Complete the checks marked NEEDS SETUP' ?></strong><p><?= $ready ? 'Open the dashboard and test signing in with your administrator account.' : 'Start with the first failed check, make the indicated change, then refresh this page.' ?></p><a href="index.html">Open dashboard</a></section>
<div class="checks">
<?php foreach ($checks as $check): ?>
<section class="check <?= $escape($check['status']) ?>" data-check="<?= $escape($check['id']) ?>" data-status="<?= $escape($check['status']) ?>"><span class="badge"><?= ['pass'=>'PASS', 'fail'=>'NEEDS SETUP', 'waiting'=>'WAITING'][$check['status']] ?></span><h2><?= $escape($check['title']) ?></h2><p><?= $escape($check['detail']) ?></p></section>
<?php endforeach; ?>
</div>
<footer>This local page inspects setup without changing records. Database passwords, account names and password hashes are not displayed. Passing these checks is a starting point for local testing, not production approval.</footer>
</main></body></html>
