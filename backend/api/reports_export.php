<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/reporting.php';
requestMethod('GET');
$pdo=database();$user=authenticatedUser($pdo);
try {
    $day=reportDate($_GET['date']??null);
    $report=buildSchoolReport($pdo,$user,$day);
    if ($report['branches_truncated']) respond(409,['error'=>'The branch summary exceeds the 200-row export limit. Contact your administrator.']);
} catch (InvalidArgumentException $e) {
    respond(400,['error'=>$e->getMessage()]);
} catch (DomainException $e) {
    respond(403,['error'=>$e->getMessage()]);
} catch (PDOException $e) {
    error_log('LEARN report export failed');
    respond(503,['error'=>'Report export unavailable. Verify attendance migrations 005 and 006.']);
}
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="learn-afghan-branch-summary-'.$day.'.csv"');
header('Cache-Control: no-store');
echo "\xEF\xBB\xBF";
$stream=fopen('php://output','wb');
if ($stream===false) {http_response_code(500);exit;}
$write=static function(array $line) use ($stream): void {
    fputcsv($stream,array_map('safeCsvCell',$line),',','"','');
};
$write(['Zone code','Zone','Branch code','Branch','Status','Students','Teachers','Staff','Student attendance recorded','Personnel attendance recorded','Date']);
foreach ($report['branches'] as $b) {
    $write([$b['zone_code'],$b['zone_name'],$b['code'],$b['name'],$b['status'],$b['students'],$b['teachers'],$b['staff'],$b['student_attendance'],$b['personnel_attendance'],$day]);
}
fclose($stream);
