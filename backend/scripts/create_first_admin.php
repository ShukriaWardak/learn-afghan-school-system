<?php
declare(strict_types=1);

// Development bootstrap only. Cannot be invoked over HTTP.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
if (($argv[1] ?? '') !== '--development-only') {
    fwrite(STDERR, "Usage: php backend/scripts/create_first_admin.php --development-only\n");
    exit(1);
}

require_once dirname(__DIR__) . '/bootstrap.php';

function prompt(string $label): string {
    fwrite(STDOUT, $label);
    $line = fgets(STDIN);
    if ($line === false) {
        fwrite(STDERR, "Input cancelled.\n");
        exit(1);
    }
    return trim($line);
}

try {
    $pdo = database();
    $existing = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($existing !== 0) {
        fwrite(STDERR, "Setup stopped: the users table already contains accounts. Ask an authorized administrator to manage users.\n");
        exit(1);
    }

    fwrite(STDOUT, "Local development setup only. Do not use personal or production credentials.\n");
    $username = prompt("Admin username (3-50 letters, numbers, dot, dash, underscore): ");
    $name = prompt("Display name: ");
    $password = prompt("New password (12+ characters; input may be visible in terminal): ");
    if (!preg_match('/^[a-zA-Z0-9._-]{3,50}$/D', $username)) {
        throw new RuntimeException("Invalid username.");
    }
    if ($name === '' || strlen($name) > 180) {
        throw new RuntimeException("Display name must be 1-180 bytes.");
    }
    if (strlen($password) < 12 || strlen($password) > 128) {
        throw new RuntimeException("Password must be 12-128 bytes.");
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->beginTransaction();
    if ((int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() !== 0) {
        $pdo->rollBack();
        throw new RuntimeException("A user was created during setup; stopped.");
    }
    $stmt = $pdo->prepare("INSERT INTO users (username, display_name, password_hash, role, active) VALUES (?, ?, ?, 'super_admin', 1)");
    $stmt->execute([$username, $name, $hash]);
    $pdo->commit();
    fwrite(STDOUT, "Development super admin created. Sign in using portal.html on localhost.\n");
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, "Setup failed: " . ($error instanceof RuntimeException ? $error->getMessage() : "check the database configuration and imported schema.") . "\n");
    exit(1);
}
