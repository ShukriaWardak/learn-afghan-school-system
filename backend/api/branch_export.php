<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/branch_directory.php';

requestMethod('GET');
$pdo = database();
$user = authenticatedUser($pdo);
$branches = visibleBranches($pdo, $user);

// Mitigate spreadsheet formula injection in text supplied through forms.
function csvText(mixed $value): string {
    $text = (string) ($value ?? '');
    if (preg_match('/^[=+@-]/u', ltrim($text)) === 1) {
        return "'" . $text;
    }
    return $text;
}

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="learn-afghan-authorized-branches.csv"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$output = fopen('php://output', 'wb');
if ($output === false) {
    http_response_code(503);
    exit;
}
fwrite($output, chr(239) . chr(187) . chr(191)); // UTF-8 BOM for Excel
fputcsv($output, ['Code', 'Branch', 'Zone', 'Location', 'Status'], ',', '"', '');
foreach ($branches as $branch) {
    $row = [
        csvText($branch['code']),
        csvText($branch['name']),
        csvText($branch['zone_name']),
        csvText($branch['location']),
        csvText($branch['status'])
    ];
    fputcsv($output, $row, ',', '"', '');
}
fclose($output);
