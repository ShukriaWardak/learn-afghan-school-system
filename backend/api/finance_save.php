<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/record_validation.php';
require_once dirname(__DIR__).'/finance.php';
requestMethod('POST');assertSameOrigin();verifyCsrf();
$pdo=database();$user=authenticatedUser($pdo);financeAccess($user,true);$body=jsonBody();
try {
    $values=financeValues($body);$id=array_key_exists('id',$body)?recordId($body,'id'):null;
    if ($id===null) {
        $key=$body['request_key']??null;
        if (!is_string($key)||!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',$key))
            throw new InvalidArgumentException('A valid submission key is required.');
        $hash=hash('sha256',json_encode($values,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
    } else {$version=recordId($body,'version');$reason=financeText($body,'correction_reason',250);}
} catch (InvalidArgumentException $e) {respond(400,['error'=>$e->getMessage()]);}
$creating=$id===null;
try {
    $pdo->beginTransaction();$before=null;
    financeValidateBranch($pdo,$user,$values['branch_id']);
    if ($creating) {
        $columns=array_keys($values);
        $statement=$pdo->prepare('INSERT INTO finance_entries('.implode(',',$columns).',created_by,updated_by,request_key,request_hash) VALUES('.implode(',',array_fill(0,count($columns)+4,'?')).')');
        $statement->execute([...array_values($values),(int)$user['id'],(int)$user['id'],$key,$hash]);
        $id=(int)$pdo->lastInsertId();$nextVersion=1;$action='finance.create';
    } else {
        [$scope,$scopeParams]=financeEntryScope($user);
        $statement=$pdo->prepare('SELECT f.* FROM finance_entries f WHERE f.id=? AND '.$scope.' FOR UPDATE');
        $statement->execute([$id,...$scopeParams]);$row=$statement->fetch();
        if (!$row) {$pdo->rollBack();respond(404,['error'=>'Finance entry not found.']);}
        if ((int)$row['version']!==$version) {$pdo->rollBack();respond(409,['error'=>'Another team member changed this entry. Close this form and refresh before editing again.']);}
        $before=financeSnapshot($row);$nextVersion=$version+1;
        $assignments=array_map(static fn($field)=>$field.'=?',array_keys($values));
        $statement=$pdo->prepare('UPDATE finance_entries SET '.implode(',',$assignments).',updated_by=?,version=version+1 WHERE id=?');
        $statement->execute([...array_values($values),(int)$user['id'],$id]);$action='finance.update';
    }
    $details=['before'=>$before,'after'=>$values,'version'=>$nextVersion];
    if (!$creating) $details['correction_reason']=$reason;
    $audit=$pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)');
    $audit->execute([(int)$user['id'],$action,'finance_entry',(string)$id,json_encode($details,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    $pdo->commit();respond($creating?201:200,['saved'=>true,'id'=>$id,'version'=>$nextVersion,'replayed'=>false]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($e instanceof DomainException) respond(403,['error'=>$e->getMessage()]);
    if ($e instanceof InvalidArgumentException) respond(400,['error'=>$e->getMessage()]);
    if ($e instanceof PDOException) {
        $code=(int)($e->errorInfo[1]??0);
        if ($code===1062 && $creating) {
            [$scope,$scopeParams]=financeEntryScope($user);
            $statement=$pdo->prepare('SELECT f.id,f.version,f.created_by,f.request_hash FROM finance_entries f WHERE f.request_key=? AND '.$scope);
            $statement->execute([$key,...$scopeParams]);$previous=$statement->fetch();
            if ($previous && (int)$previous['created_by']===(int)$user['id'] && hash_equals($previous['request_hash'],$hash))
                respond(200,['saved'=>true,'id'=>(int)$previous['id'],'version'=>(int)$previous['version'],'replayed'=>true]);
            respond(409,['error'=>'This submission key was already used. Close the form and refresh to check saved records.']);
        }
        if ($code===1452) respond(400,['error'=>'Select an existing branch or central office.']);
    }
    error_log('LEARN finance save failed');respond(500,['error'=>'Could not save the finance entry. Confirm migration 007 is installed.']);
}
