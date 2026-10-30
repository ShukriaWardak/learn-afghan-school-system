<?php
declare(strict_types=1);
function recordText(array $body,string $field,int $max): string {
 $value=$body[$field]??null;
 if (!is_string($value)) throw new InvalidArgumentException($field.' is required');
 $value=trim($value);
 if (!preg_match('/^.{1,'.$max.'}$/us',$value) || preg_match('/[\x00-\x1F\x7F]/u',$value))
  throw new InvalidArgumentException('Invalid '.$field);
 return $value;
}
function recordCode(array $body): string {
 $code=strtoupper(recordText($body,'code',45));
 if (!preg_match('/^[A-Z0-9][A-Z0-9_-]{1,44}$/',$code)) throw new InvalidArgumentException('Code must contain 2–45 letters, numbers, underscores or hyphens');
 return $code;
}
function recordId(array $body,string $field): int {
 $value=$body[$field]??null;
 if (!is_int($value)||$value<1) throw new InvalidArgumentException('Invalid '.$field);
 return $value;
}
