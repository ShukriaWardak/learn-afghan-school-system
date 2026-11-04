<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/branch_approvals.php';
requestMethod('GET');
$pdo=database();$user=authenticatedUser($pdo);
if ($user['role']!=='super_admin') respond(403,['error'=>'Only super administrators can review pending branches']);
try {
    $rows=$pdo->query("SELECT b.id,b.code,b.name,b.zone_id,b.location,b.status,b.created_at,b.updated_at,z.name AS zone_name
        FROM branches b JOIN zones z ON z.id=b.zone_id WHERE b.status='pending'
        ORDER BY b.created_at,b.id LIMIT 201")->fetchAll();
    $history=$pdo->query("SELECT a.id,a.entity_id,a.action,a.details_json,a.created_at,u.display_name AS reviewer
        FROM audit_events a LEFT JOIN users u ON u.id=a.actor_user_id
        WHERE a.entity_type='branch' AND a.action IN ('branch.approve','branch.reject')
        ORDER BY a.id DESC LIMIT 50")->fetchAll();
    $decisions=array_map(static function(array $row): array {
        $details=json_decode((string)($row['details_json']??''),true);
        $details=is_array($details)?$details:[];
        return [
            'id'=>(int)$row['id'],'branch_id'=>(int)$row['entity_id'],
            'branch_code'=>is_string($details['branch']['code']??null)?$details['branch']['code']:'',
            'branch_name'=>is_string($details['branch']['name']??null)?$details['branch']['name']:'',
            'decision'=>$row['action']==='branch.approve'?'approve':'reject',
            'note'=>is_string($details['note']??null)?$details['note']:'',
            'reviewer'=>$row['reviewer'],'created_at'=>$row['created_at'],
        ];
    },$history);
    respond(200,[
        'approvals'=>array_map('pendingBranchReview',array_slice($rows,0,200)),
        'limit'=>200,'truncated'=>count($rows)>200,'decisions'=>$decisions,'history_limit'=>50,
    ]);
} catch (Throwable $error) {
    error_log('LEARN branch approvals read failed');
    respond(503,['error'=>'Branch approvals are unavailable. Check the branches, zones and audit tables.']);
}
