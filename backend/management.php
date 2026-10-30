<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';

/** Every management endpoint verifies the database-backed role, never a browser claim. */
function requireSuperAdmin(PDO $pdo): array {
    $user = authenticatedUser($pdo);
    if ($user['role'] !== 'super_admin') respond(403, ['error' => 'Super admin access required']);
    return $user;
}

function textField(array $body, string $field, int $max, bool $required = true): ?string {
    $value = $body[$field] ?? null;
    if ($value === null && !$required) return null;
    if (!is_string($value)) respond(422, ['error' => 'Invalid ' . $field]);
    $value = trim($value);
    if ($value === '') {
        if (!$required) return null;
        respond(422, ['error' => $field . ' is required']);
    }
    $length = preg_match_all('/./us', $value);
    if ($length === false || $length > $max || preg_match('/[\x00-\x1f\x7f]/u', $value)) {
        respond(422, ['error' => $field . ' has invalid characters or is too long']);
    }
    return $value;
}

function codeField(array $body): string {
    $code = textField($body, 'code', 30);
    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/D', $code)) {
        respond(422, ['error' => 'Code must be 2–30 letters, numbers, hyphens or underscores']);
    }
    return strtoupper($code);
}

function positiveId(mixed $value, string $label): int {
    if ((!is_int($value) && !is_string($value)) ||
        filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
        respond(422, ['error' => 'Invalid ' . $label]);
    }
    return (int) $value;
}

function auditChange(PDO $pdo, array $actor, string $action, string $entity, int $id, array $details): void {
    $stmt = $pdo->prepare(
        'INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)'
    );
    $stmt->execute([
        (int) $actor['id'], $action, $entity, (string) $id,
        json_encode($details, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)
    ]);
}

function managementFailure(PDOException $e): never {
    error_log('LEARN management operation failed (SQLSTATE ' . $e->getCode() . ')');
    if ((string) $e->getCode() === '23000') {
        respond(409, ['error' => 'Duplicate code or related record conflict']);
    }
    respond(503, ['error' => 'The database could not save this change']);
}
