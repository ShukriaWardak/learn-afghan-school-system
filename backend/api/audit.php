<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/management.php';

requestMethod('GET');
$pdo = database();
requireSuperAdmin($pdo);

// Show only organizational edits for this development UI, without potentially
// confidential details_json contents. Limit results to avoid overlarge responses.
$sql = "SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at,
               CASE WHEN u.id IS NULL THEN 'Former or system account'
                    ELSE u.display_name END AS actor_name
        FROM audit_events a
        LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.entity_type IN ('zone', 'branch', 'department')
        ORDER BY a.id DESC
        LIMIT 50";
$events = $pdo->query($sql)->fetchAll();
respond(200, ['events' => $events]);
