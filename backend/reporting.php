<?php
declare(strict_types=1);

/**
 * Read-only, aggregate reports for authenticated LEARN Afghan roles.
 * All counts are computed from MySQL; no records are seeded or stored in the browser.
 */
function reportDate(mixed $value): string {
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) {
        throw new InvalidArgumentException('Provide a valid date in YYYY-MM-DD format.');
    }
    if (substr($value,0,4)==='0000') {
        throw new InvalidArgumentException('Provide a valid date in YYYY-MM-DD format.');
    }
    $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$value);
    if (!$parsed || $parsed->format('Y-m-d')!==$value) {
        throw new InvalidArgumentException('Provide a valid date in YYYY-MM-DD format.');
    }
    return $value;
}
function reportScope(array $user): array {
    switch ($user['role']) {
        case 'super_admin': return ['1=1',[]];
        case 'zone_admin':
            if (empty($user['zone_id'])) throw new DomainException('Zone assignment required.');
            return ['b.zone_id=?',[(int)$user['zone_id']]];
        case 'branch_admin':
            if (empty($user['branch_id'])) throw new DomainException('Branch assignment required.');
            return ['b.id=?',[(int)$user['branch_id']]];
        default: throw new DomainException('Reports access denied.');
    }
}
function reportRows(PDO $pdo,string $sql,array $params): array {
    $stmt=$pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
function reportAddCounts(array &$target,array $rows,string $key='status'): void {
    foreach ($rows as $row) {
        $name=(string)($row[$key]??'');
        if (array_key_exists($name,$target)) $target[$name]=(int)$row['quantity'];
    }
}
function buildSchoolReport(PDO $pdo,array $user,string $day): array {
    [$scope,$params]=reportScope($user);
    $emptyStatuses=['present'=>0,'absent'=>0,'late'=>0,'excused'=>0];
    $studentStatuses=['active'=>0,'inactive'=>0,'graduated'=>0];
    $personnelStatuses=['active'=>0,'inactive'=>0];
    $personnel=['teacher'=>$personnelStatuses,'staff'=>$personnelStatuses];
    $personnelAttendance=['teacher'=>$emptyStatuses,'staff'=>$emptyStatuses];
    $studentAttendance=$emptyStatuses;

    $branchCount=reportRows($pdo,'SELECT COUNT(*) AS quantity,COUNT(DISTINCT b.zone_id) AS zones FROM branches b WHERE '.$scope,$params)[0];
    $students=reportRows($pdo,'SELECT s.status,COUNT(*) AS quantity FROM students s JOIN branches b ON b.id=s.branch_id WHERE '.$scope.' GROUP BY s.status',$params);
    reportAddCounts($studentStatuses,$students);
    $persons=reportRows($pdo,'SELECT p.kind,p.status,COUNT(*) AS quantity FROM personnel p JOIN branches b ON b.id=p.branch_id WHERE '.$scope.' GROUP BY p.kind,p.status',$params);
    foreach ($persons as $row) {
        $kind=(string)$row['kind'];$status=(string)$row['status'];
        if (isset($personnel[$kind]) && array_key_exists($status,$personnel[$kind])) {
            $personnel[$kind][$status]=(int)$row['quantity'];
        }
    }
    $attendance=reportRows($pdo,'SELECT a.status,COUNT(*) AS quantity FROM student_attendance a JOIN students s ON s.id=a.student_id JOIN branches b ON b.id=s.branch_id WHERE a.attendance_date=? AND '.$scope.' GROUP BY a.status',array_merge([$day],$params));
    reportAddCounts($studentAttendance,$attendance);
    $attendancePersonnel=reportRows($pdo,'SELECT p.kind,a.status,COUNT(*) AS quantity FROM personnel_attendance a JOIN personnel p ON p.id=a.personnel_id JOIN branches b ON b.id=p.branch_id WHERE a.attendance_date=? AND '.$scope.' GROUP BY p.kind,a.status',array_merge([$day],$params));
    foreach ($attendancePersonnel as $row) {
        $kind=(string)$row['kind'];$status=(string)$row['status'];
        if (isset($personnelAttendance[$kind]) && array_key_exists($status,$personnelAttendance[$kind])) {
            $personnelAttendance[$kind][$status]=(int)$row['quantity'];
        }
    }
    $branches=reportRows($pdo,'
        SELECT b.id,b.code,b.name,b.status,z.code AS zone_code,z.name AS zone_name,
          (SELECT COUNT(*) FROM students s WHERE s.branch_id=b.id) AS student_count,
          (SELECT COUNT(*) FROM personnel p WHERE p.branch_id=b.id AND p.kind="teacher") AS teacher_count,
          (SELECT COUNT(*) FROM personnel p WHERE p.branch_id=b.id AND p.kind="staff") AS staff_count,
          (SELECT COUNT(*) FROM student_attendance sa JOIN students s2 ON s2.id=sa.student_id
            WHERE s2.branch_id=b.id AND sa.attendance_date=?) AS student_attendance_count,
          (SELECT COUNT(*) FROM personnel_attendance pa JOIN personnel p2 ON p2.id=pa.personnel_id
            WHERE p2.branch_id=b.id AND pa.attendance_date=?) AS personnel_attendance_count
        FROM branches b JOIN zones z ON z.id=b.zone_id WHERE '.$scope.'
        ORDER BY z.code,b.code,b.id LIMIT 201',
        array_merge([$day,$day],$params));
    $truncated=count($branches)>200;
    if ($truncated) $branches=array_slice($branches,0,200);
    $branches=array_map(static fn(array $row): array => [
        'id'=>(int)$row['id'],'code'=>$row['code'],'name'=>$row['name'],
        'status'=>$row['status'],'zone_code'=>$row['zone_code'],'zone_name'=>$row['zone_name'],
        'students'=>(int)$row['student_count'],'teachers'=>(int)$row['teacher_count'],
        'staff'=>(int)$row['staff_count'],
        'student_attendance'=>(int)$row['student_attendance_count'],
        'personnel_attendance'=>(int)$row['personnel_attendance_count'],
    ],$branches);
    return [
        'date'=>$day,
        'scope'=>$user['role'],
        'totals'=>[
            'zones'=>(int)$branchCount['zones'],
            'branches'=>(int)$branchCount['quantity'],
            'students'=>array_sum($studentStatuses),
            'teachers'=>array_sum($personnel['teacher']),
            'staff'=>array_sum($personnel['staff']),
        ],
        'student_status'=>$studentStatuses,
        'personnel_status'=>$personnel,
        'attendance'=>[
            'students'=>$studentAttendance,
            'teachers'=>$personnelAttendance['teacher'],
            'staff'=>$personnelAttendance['staff']
        ],
        'branches'=>$branches,
        'branch_limit'=>200,'branches_truncated'=>$truncated
    ];
}
/** Prevent spreadsheet formula execution and embedded line breaks in Excel/Sheets CSV. */
function safeCsvCell(mixed $value): string {
    $value=preg_replace('/[\r\n\t]/u',' ',(string)$value);
    if (preg_match('/^\s*[=+\-@]/u',$value)) $value="'".$value;
    return $value;
}
