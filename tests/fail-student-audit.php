<?php
// Fault injection for the disposable CI database only. Never run on a working installation.
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || getenv('LEARN_INTEGRATION_TEST') !== '1') exit(1);
$config = require __DIR__.'/../backend/config.local.php';
if ($config['database'] !== 'learn_afghan' || $config['username'] !== 'root'
 || !$config['password'] || $config['password'] !== getenv('MYSQL_TEST_PASSWORD')) exit(1);
$pdo = new PDO('mysql:host=127.0.0.1;port=3306;dbname=learn_afghan;charset=utf8mb4', 'root', $config['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$testUser = $pdo->query("SELECT password_hash FROM users WHERE username='test_super'")->fetchColumn();
if (!$testUser || !password_verify('Disposable-test-password-2026', $testUser)) exit(1);
if (($argv[1] ?? '') === 'enable') {
 $pdo->exec("CREATE TRIGGER learn_test_reject_audit BEFORE INSERT ON audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Disposable audit failure'");
} elseif (($argv[1] ?? '') === 'disable') {
 $pdo->exec('DROP TRIGGER IF EXISTS learn_test_reject_audit');
} else { exit(1); }
