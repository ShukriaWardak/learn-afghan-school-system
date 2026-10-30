<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/branch_directory.php';

requestMethod('GET');
$pdo = database();
$user = authenticatedUser($pdo);
respond(200, ['branches' => visibleBranches($pdo, $user)]);
