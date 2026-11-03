<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/reporting.php';
requestMethod('GET');
$pdo=database();$user=authenticatedUser($pdo);
try {
    $day=reportDate($_GET['date']??null);
    $report=buildSchoolReport($pdo,$user,$day);
    respond(200,$report);
} catch (InvalidArgumentException $e) {
    respond(400,['error'=>$e->getMessage()]);
} catch (DomainException $e) {
    respond(403,['error'=>$e->getMessage()]);
} catch (PDOException $e) {
    error_log('LEARN school report query failed');
    respond(503,['error'=>'Reports are temporarily unavailable. Verify attendance migrations 005 and 006.']);
}
