<?php
declare(strict_types=1);
// Scope follows the owner's CURRENT account assignment. Unassigned scopes grant no extra access.
function taskLogScope(array $user): array {
 if ($user['role']==='super_admin') return ['1=1',[]];
 $own='t.owner_user_id=?'; $args=[(int)$user['id']];
 if ($user['role']==='zone_admin' && !empty($user['zone_id'])) {
  return ['('.$own.' OR b.zone_id=? OR (u.branch_id IS NULL AND u.zone_id=?))', [...$args,(int)$user['zone_id'],(int)$user['zone_id']]];
 }
 if ($user['role']==='branch_admin' && !empty($user['branch_id'])) return ['('.$own.' OR u.branch_id=?)',[...$args,(int)$user['branch_id']]];
 return [$own,$args];
}
function taskLogDate(mixed $value): string {
 if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D',$value)) throw new InvalidArgumentException('Use a valid YYYY-MM-DD date');
 [$year,$month,$day]=array_map('intval',explode('-',$value));
 if ($year<1000 || !checkdate($month,$day,$year)) throw new InvalidArgumentException('Invalid date');
 return $value;
}
function taskLogNotes(array $body,string $key): string {
 $v=$body[$key]??'';
 if (!is_string($v) || strlen($v)>2000 || !preg_match('//u',$v) || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/',$v)) throw new InvalidArgumentException('Invalid '.$key.' (maximum 2000 bytes)');
 return trim($v);
}
