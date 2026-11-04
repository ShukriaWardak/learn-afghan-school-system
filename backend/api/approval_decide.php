<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/record_validation.php';
require_once dirname(__DIR__).'/branch_approvals.php';
requestMethod('POST');assertSameOrigin();verifyCsrf();
$pdo=database();$user=authenticatedUser($pdo);
if ($user['role']!=='super_admin') respond(403,['error'=>'Only super administrators can decide branch approvals']);
$body=jsonBody();
try {
    $id=recordId($body,'branch_id');
    $decision=$body['decision']??null;
    if (!in_array($decision,['approve','reject'],true)) throw new InvalidArgumentException('Choose approve or reject');
    $version=$body['review_version']??null;
    if (!is_string($version) || !preg_match('/^[a-f0-9]{64}$/D',$version)) throw new InvalidArgumentException('Refresh the branch review before deciding');
    $note=$body['note']??'';
    if (!is_string($note)) throw new InvalidArgumentException('Invalid review note');
    $note=trim($note);
    if ($note!=='') $note=recordText(['note'=>$note],'note',500);
    if ($decision==='reject' && $note==='') throw new InvalidArgumentException('Provide a reason for rejecting this branch');
} catch (InvalidArgumentException $error) {
    respond(400,['error'=>$error->getMessage()]);
}
try {
    $pdo->beginTransaction();
    $query=$pdo->prepare('SELECT id,code,name,zone_id,location,status,created_at,updated_at FROM branches WHERE id=? FOR UPDATE');
    $query->execute([$id]);$row=$query->fetch();
    if (!$row) {$pdo->rollBack();respond(404,['error'=>'Branch not found']);}
    if ($row['status']!=='pending') {
        $pdo->rollBack();respond(409,['error'=>'This branch is no longer pending. Refresh the approvals queue.']);
    }
    if (!hash_equals(branchReviewVersion($row),$version)) {
        $pdo->rollBack();respond(409,['error'=>'Branch details changed after this review was opened. Refresh before deciding.']);
    }
    $status=$decision==='approve'?'active':'inactive';
    $update=$pdo->prepare('UPDATE branches SET status=? WHERE id=?');
    $update->execute([$status,$id]);
    $audit=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)');
    $audit->execute([(int)$user['id'],'branch.'.$decision,'branch',(string)$id,
        json_encode(['branch'=>branchReviewFields($row),'before'=>'pending','after'=>$status,'note'=>$note],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    $pdo->commit();
    respond(200,['decided'=>true,'branch_id'=>$id,'status'=>$status]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('LEARN branch approval write failed');
    respond(500,['error'=>'Could not record the approval decision. Branch status was not changed.']);
}
