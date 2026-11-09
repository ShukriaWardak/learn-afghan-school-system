<?php
declare(strict_types=1);

function financeCanWrite(array $user): bool {
    return $user['role']==='department_user' && strtoupper((string)($user['department_code']??''))==='FINANCE';
}
function financeAccess(array $user,bool $write=false): void {
    if ($write ? !financeCanWrite($user) : ($user['role']!=='super_admin' && !financeCanWrite($user)))
        respond(403,['error'=>$write?'Only Finance department members may add or edit finance records.':'Finance access denied.']);
}
function financeCentralOffice(array $user): bool {
    return $user['role']==='super_admin'
        || (($user['branch_id']??null)===null && ($user['zone_id']??null)===null);
}
function financeBranchScope(array $user,string $alias='b'): array {
    if ($user['role']==='super_admin') return ['1=1',[]];
    $clauses=[];$params=[];
    if (($user['branch_id']??null)!==null) {$clauses[]=$alias.'.id=?';$params[]=(int)$user['branch_id'];}
    if (($user['zone_id']??null)!==null) {$clauses[]=$alias.'.zone_id=?';$params[]=(int)$user['zone_id'];}
    return [$clauses?implode(' AND ',$clauses):'1=1',$params];
}
function financeEntryScope(array $user): array {
    [$scope,$params]=financeBranchScope($user,'finance_branch');
    return $scope==='1=1' ? ['1=1',[]]
        : ['f.branch_id IN (SELECT finance_branch.id FROM branches finance_branch WHERE '.$scope.')',$params];
}
function financeValidateBranch(PDO $pdo,array $user,?int $branch): void {
    if ($branch===null) {
        if (!financeCentralOffice($user)) throw new DomainException('Central office records are outside your assigned finance area.');
        return;
    }
    [$scope,$params]=financeBranchScope($user);
    $check=$pdo->prepare('SELECT b.id FROM branches b WHERE b.id=? AND '.$scope);
    $check->execute([$branch,...$params]);
    if (!$check->fetchColumn()) throw new InvalidArgumentException('Select an existing branch in your assigned finance area.');
}
function financeCategories(): array {
    return [
        'income'=>['donation'=>'Donation','grant'=>'Grant','fees'=>'Fees','other_income'=>'Other income'],
        'expense'=>['supplies'=>'Supplies','rent'=>'Rent','utilities'=>'Utilities','transport'=>'Transport',
            'staff_costs'=>'Staff costs','program_costs'=>'Program costs','other_expense'=>'Other expense'],
    ];
}
function financeMethods(): array {
    return ['cash'=>'Cash','bank_transfer'=>'Bank transfer','mobile_money'=>'Mobile money'];
}
function financeText(array $body,string $field,int $max,bool $required=true): string {
    $value=$body[$field]??($required?null:'');
    if (!is_string($value)) throw new InvalidArgumentException('Invalid '.$field);
    $value=trim(str_replace(["\r\n","\r"],"\n",$value));
    if (!preg_match('/^.{'.($required?'1':'0').','.$max.'}$/usD',$value)
        || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u',$value))
        throw new InvalidArgumentException('Invalid '.$field);
    return $value;
}
function financeDate(mixed $value): string {
    if (!is_string($value) || !preg_match('/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/D',$value))
        throw new InvalidArgumentException('Use a valid date between 2000 and 2099.');
    $date=DateTimeImmutable::createFromFormat('!Y-m-d',$value);
    if (!$date || $date->format('Y-m-d')!==$value) throw new InvalidArgumentException('Invalid date.');
    return $value;
}
function financeAmount(mixed $value): string {
    // Keep decimal money as strings from input through PDO; never cast to float.
    if (!is_string($value) || !preg_match('/^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?$/D',$value))
        throw new InvalidArgumentException('Amount must be a positive AFN value with at most two decimal places.');
    [$whole,$fraction]=array_pad(explode('.',$value),2,'');
    $normalized=$whole.'.'.str_pad($fraction,2,'0');
    if ($normalized==='0.00') throw new InvalidArgumentException('Amount must be greater than zero.');
    return $normalized;
}
function financeValues(array $body): array {
    $type=$body['entry_type']??null;$category=$body['category']??null;$method=$body['payment_method']??null;
    if (!is_string($type) || !array_key_exists($type,financeCategories())) throw new InvalidArgumentException('Invalid income/expense type.');
    if (!is_string($category) || !array_key_exists($category,financeCategories()[$type])) throw new InvalidArgumentException('Choose a category for this income/expense type.');
    if (!is_string($method) || !array_key_exists($method,financeMethods())) throw new InvalidArgumentException('Invalid payment method.');
    if (($body['currency']??null)!=='AFN') throw new InvalidArgumentException('Currency must be AFN.');
    $branch=$body['branch_id']??null;
    if ($branch!==null && (!is_int($branch)||$branch<1)) throw new InvalidArgumentException('Invalid branch.');
    return ['entry_date'=>financeDate($body['entry_date']??null),'entry_type'=>$type,'category'=>$category,
        'amount'=>financeAmount($body['amount']??null),'currency'=>'AFN','branch_id'=>$branch,
        'counterparty'=>financeText($body,'counterparty',180),'payment_method'=>$method,
        'receipt_reference'=>financeText($body,'receipt_reference',80,false),
        'description'=>financeText($body,'description',500),'notes'=>financeText($body,'notes',500,false)];
}
function financeSnapshot(array $row): array {
    $result=[];
    foreach (['entry_date','entry_type','category','amount','currency','branch_id','counterparty','payment_method','receipt_reference','description','notes'] as $field)
        $result[$field]=$field==='branch_id'?($row[$field]===null?null:(int)$row[$field]):$row[$field];
    return $result;
}
