<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/finance.php';
requestMethod('GET');
$pdo=database();$user=authenticatedUser($pdo);financeAccess($user);
try {
    [$scope,$params]=financeEntryScope($user);$where=[$scope];
    $branch=$_GET['branch']??'all';
    if (!is_string($branch)) throw new InvalidArgumentException('Invalid branch filter.');
    if ($branch==='central') $where[]='f.branch_id IS NULL';
    elseif ($branch!=='all') {
        if (!preg_match('/^[1-9][0-9]{0,9}$/D',$branch)) throw new InvalidArgumentException('Invalid branch filter.');
        $where[]='f.branch_id=?';$params[]=(int)$branch;
    }
    $from=($_GET['from']??'')===''?null:financeDate($_GET['from']);
    $to=($_GET['to']??'')===''?null:financeDate($_GET['to']);
    if ($from!==null && $to!==null && $from>$to) throw new InvalidArgumentException('Start date must be before the end date.');
    if ($from!==null) {$where[]='f.entry_date>=?';$params[]=$from;}
    if ($to!==null) {$where[]='f.entry_date<=?';$params[]=$to;}
    $type=$_GET['type']??'all';
    if (!in_array($type,['all','income','expense'],true)) throw new InvalidArgumentException('Invalid finance filter.');
    if ($type!=='all') {$where[]='f.entry_type=?';$params[]=$type;}
    $search=financeText(['search'=>$_GET['search']??''],'search',100,false);
    if ($search!=='') {
        $like='%'.str_replace(['!','%','_'],['!!','!%','!_'],$search).'%';
        $where[]="(f.counterparty LIKE ? ESCAPE '!' OR f.description LIKE ? ESCAPE '!' OR f.receipt_reference LIKE ? ESCAPE '!')";
        array_push($params,$like,$like,$like);
    }
    $page=$_GET['page']??'1';
    if (!is_string($page) || !preg_match('/^[1-9][0-9]{0,5}$/D',$page)) throw new InvalidArgumentException('Invalid page.');
    $page=(int)$page;$pageSize=50;
} catch (InvalidArgumentException $e) {respond(400,['error'=>$e->getMessage()]);}
try {
    $pdo->beginTransaction();
    $clause=$where?' WHERE '.implode(' AND ',$where):'';
    $statement=$pdo->prepare("SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN entry_type='income' THEN amount ELSE 0 END),0.00) AS income,COALESCE(SUM(CASE WHEN entry_type='expense' THEN amount ELSE 0 END),0.00) AS expense,COALESCE(SUM(CASE WHEN entry_type='income' THEN amount ELSE -amount END),0.00) AS net FROM finance_entries f".$clause);
    $statement->execute($params);$totals=$statement->fetch();$total=(int)$totals['total'];
    $pages=max(1,(int)ceil($total/$pageSize));$page=min($page,$pages);$offset=($page-1)*$pageSize;
    $statement=$pdo->prepare('SELECT f.id,f.entry_date,f.entry_type,f.category,f.amount,f.currency,f.branch_id,f.counterparty,f.payment_method,f.receipt_reference,f.description,f.notes,f.version,f.created_at,f.updated_at,b.name AS branch_name,u.display_name AS updated_by_name,creator.display_name AS created_by_name FROM finance_entries f LEFT JOIN branches b ON b.id=f.branch_id LEFT JOIN users u ON u.id=f.updated_by LEFT JOIN users creator ON creator.id=f.created_by'.$clause.' ORDER BY f.entry_date DESC,f.id DESC LIMIT '.$pageSize.' OFFSET '.$offset);
    $statement->execute($params);$rows=$statement->fetchAll();
    foreach ($rows as &$row) {$row['id']=(int)$row['id'];$row['version']=(int)$row['version'];$row['branch_id']=$row['branch_id']===null?null:(int)$row['branch_id'];}unset($row);
    [$branchScope,$branchParams]=financeBranchScope($user);
    $branchQuery=$pdo->prepare('SELECT b.id,b.code,b.name FROM branches b WHERE '.$branchScope.' ORDER BY b.code,b.id');
    $branchQuery->execute($branchParams);$branches=$branchQuery->fetchAll();
    $team=(int)$pdo->query("SELECT COUNT(*) FROM users u JOIN departments d ON d.id=u.department_id WHERE u.role='department_user' AND u.active=1 AND d.code='FINANCE'")->fetchColumn();
    $writable=financeCanWrite($user) && (financeCentralOffice($user) || count($branches)>0);
    $pdo->commit();
    respond(200,['entries'=>$rows,'currency'=>'AFN','page'=>$page,'pages'=>$pages,'page_size'=>$pageSize,'total'=>$total,
        'totals'=>['income'=>(string)$totals['income'],'expense'=>(string)$totals['expense'],'net'=>(string)$totals['net']],
        'permissions'=>['can_add'=>$writable,'can_edit'=>$writable,'can_delete'=>false,'can_use_central_office'=>financeCentralOffice($user)],
        'categories'=>financeCategories(),'payment_methods'=>financeMethods(),'branches'=>$branches,'active_team_members'=>$team]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('LEARN finance read failed');respond(503,['error'=>'Finance is unavailable. Confirm migration 007 is installed.']);
}
