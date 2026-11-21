<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
require_once dirname(__DIR__).'/record_validation.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET','POST'], true)) {
 header('Allow: GET, POST');
 respond(405, ['error'=>'Method not allowed']);
}
$pdo = database();
$user = authenticatedUser($pdo);
$admin = $user['role'] === 'super_admin';
try {
 if ($method === 'GET') {
  $sql = 'SELECT c.*, b.name AS branch_name FROM class_register c JOIN branches b ON b.id=c.branch_id';
  $params = [];
  if (!$admin) {
   if ($user['role']==='branch_admin' && $user['branch_id']) {
    $sql .= ' WHERE c.branch_id=?';
    $params[] = $user['branch_id'];
   } elseif ($user['role']==='zone_admin' && $user['zone_id']) {
    $sql .= ' WHERE b.zone_id=?';
    $params[] = $user['zone_id'];
   } else respond(403,['error'=>'Classes are unavailable for your role.']);
  }
  $query = $pdo->prepare($sql.' ORDER BY c.academic_year DESC,b.name,c.grade_level,c.section,c.id LIMIT 501');
  $query->execute($params);
  $rows = $query->fetchAll();
  respond(200,['classes'=>array_slice($rows,0,500),'has_more'=>count($rows)>500,'can_edit'=>$admin]);
 }
 if (!$admin) respond(403,['error'=>'Only the super administrator can save classes.']);
 assertSameOrigin();
 verifyCsrf();
 $body = jsonBody();
 $branch = recordId($body,'branch_id');
 $year = recordId($body,'academic_year');
 $grade = recordId($body,'grade_level');
 $section = recordText($body,'section',40);
 $active = $body['active'] ?? null;
 if ($year<2000 || $year>2100 || $grade>12 || !is_bool($active)) {
  throw new InvalidArgumentException('Use an academic start year from 2000–2100 and a grade from 1–12.');
 }
 $id = array_key_exists('id',$body) ? recordId($body,'id') : null;
 $pdo->beginTransaction();
 $values = [$branch,$year,$grade,$section,(int)$active];
 if ($id===null) {
  $pdo->prepare('INSERT INTO class_register(branch_id,academic_year,grade_level,section,active) VALUES(?,?,?,?,?)')->execute($values);
  $id = (int)$pdo->lastInsertId();
  $action = 'class.create';
 } else {
  $version = recordId($body,'version');
  $stmt = $pdo->prepare('UPDATE class_register SET branch_id=?,academic_year=?,grade_level=?,section=?,active=?,version=version+1 WHERE id=? AND version=?');
  $stmt->execute([...$values,$id,$version]);
  if (!$stmt->rowCount()) {
   $pdo->rollBack();
   respond(409,['error'=>'This class changed or is unavailable. Reload the list before editing.']);
  }
  $action = 'class.update';
 }
 $pdo->prepare('INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?)')
     ->execute([$user['id'],$action,'class',(string)$id]);
 $pdo->commit();
 respond($action==='class.create'?201:200,['id'=>$id]);
} catch (InvalidArgumentException $e) {
 if ($pdo->inTransaction()) $pdo->rollBack();
 respond(400,['error'=>$e->getMessage()]);
} catch (PDOException $e) {
 if ($pdo->inTransaction()) $pdo->rollBack();
 $code = (int)($e->errorInfo[1] ?? 0);
 if ($code===1062) respond(409,['error'=>'That branch, year, grade and section already exist.']);
 if ($code===1452) respond(400,['error'=>'Select an existing branch.']);
 if ($code===1146) respond(503,['error'=>'Class register unavailable. Ask your administrator to verify migration 009.']);
 error_log('LEARN class register failed');
 respond(500,['error'=>'Could not complete the class register request.']);
}
