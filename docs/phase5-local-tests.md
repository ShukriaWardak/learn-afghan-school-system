# LEARN Afghan — Phase 5 local test checklist

**Scope:** XAMPP development environment only. Do not use actual student, staff, HR, medical, salary or other confidential data. Get team authorization and official zone/branch codes before writing persistent organization records.

## Setup
1. Confirm Apache and MySQL are green in XAMPP; PHP 8.1+.
2. In phpMyAdmin choose the **`learn_afghan`** database and verify: `zones`, `branches`, `departments`, `users`, `audit_events`, `login_attempts`.
3. Import `database/schema.sql` and `database/002_login_attempts.sql` only if not already applied. The scripts are idempotent table creations, but **do not overwrite an existing database** or use another schema name accidentally.
4. Configure `backend/config.local.php` with development-only database credentials; keep it out of Git.
5. Have an authorized developer create the first local Super Admin using the CLI-only helper if no users exist.
6. Open `http://localhost/learn-afghan-school-system/portal.html` (adjust the folder path).

## Expected results

| Test | Expected outcome |
| --- | --- |
| No active login: GET `backend/api/branches.php` | HTTP 401; no records |
| No active login: GET `backend/api/zones.php` | HTTP 401; no records |
| Wrong password | HTTP 401; login attempt recorded |
| Valid development Super Admin | Portal opens; official zones and visible branches load from MySQL |
| No official zones or branches entered | Empty branch list, not 25 invented records |
| Create an authorized zone with an approved unique code | HTTP 201; zone is visible; `audit_events` includes a zone creation |
| Try the same zone code twice | HTTP 409; second row not inserted |
| Create branch with existing approved zone and unique code | HTTP 201; branch appears; audit event recorded |
| Edit existing branch | HTTP 200; row changes; before/after audit entry recorded |
| Create branch with nonexistent zone ID | HTTP 422; no branch or audit row inserted |
| Create or edit branch with missing or invalid CSRF token | HTTP 403; nothing changed |
| Zone Admin or Branch Admin attempts POST to write endpoints | HTTP 403; nothing changed |
| Zone Admin GET branches | Only branches from assigned zone |
| Branch Admin GET branches | Only the assigned branch |
| Department User GET branches | HTTP 403 |
| Sign out | Session ends; branch API rejects unauthenticated request |

Test duplicate branch codes and invalid field lengths as well. Use test accounts only in local development, remove them when done, and verify your administrator has approved all records before copying to a shared environment.

## SQL verification (phpMyAdmin, development only)

```sql
USE learn_afghan;
SELECT id, code, name FROM zones ORDER BY id DESC;
SELECT id, code, name, zone_id, status FROM branches ORDER BY id DESC;
SELECT id, actor_user_id, action, entity_type, entity_id, created_at
FROM audit_events
ORDER BY id DESC LIMIT 20;
```

## Known limitations
- The original `index.html` command center remains a separate localStorage demo.
- Only a Super Admin can write zone/branch records in this phase.
- No production-ready account lifecycle, backup/restore testing, approval workflow, policy review, or security sign-off.
- This checklist is **not evidence of tests having passed**. Record actual outcomes once run on the team's Windows XAMPP installation.
