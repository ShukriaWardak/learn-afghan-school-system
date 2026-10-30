# Phase 8 — Teacher and Staff directories (development-only)

## Setup

1. Check that the project branch is `feature/php-mysql-portal-20261030`.
2. Start Apache and MySQL in XAMPP.
3. **Back up your development database before applying a migration.**
4. In phpMyAdmin, import `database/003_personnel_directories.sql`. The migration uses the existing **`learn_afghan`** database; it creates two empty tables only.
5. Verify these tables exist: `teacher_records` and `staff_records`. Existing zones, branches, departments, users, and audit events are retained.
6. Create only **team-approved development test records** (no actual personnel, addresses, medical, or salary data). Teachers require an existing branch; staff require an existing department and optionally a branch.

## Endpoints
- GET `backend/api/people.php?kind=teacher` — directory scoped to current Super Admin, Zone Admin or Branch Admin. Department users receive 403.
- GET `backend/api/people.php?kind=staff` — same scope. Central staff (no branch) appear only to Super Admin.
- POST `backend/api/people.php?kind=teacher` — Super Admin only; JSON with `action`, `code`, `display_name`, `branch_id`, `status` and `id` for updates; CSRF header required.
- POST `backend/api/people.php?kind=staff` — Super Admin only; same plus required `department_id`, optional `branch_id`.
- GET `backend/api/audit.php` — Super Admin only; includes teacher/staff creation and updates without disclosing detailed JSON or names.

## Local checks

Use the project folder in PowerShell:

```powershell
C:\xampp\php\php.exe -l backend\api\people.php
C:\xampp\php\php.exe -l backend\api\audit.php
```

## Expected authorization/validation tests

| Scenario | Expected |
| --- | --- |
| Unauthenticated GET people | 401 |
| Unauthenticated POST people | 401 or 403; no database write |
| Department user GET people | 403 |
| Zone admin GET people | Only people from branches belonging to their assigned zone |
| Branch admin GET people | Only people assigned to their branch |
| Zone or branch admin POST | 403, no database write |
| Super Admin GET people | Directory records from all branches, central staff included |
| Super Admin valid teacher creation | 201, teacher record appears |
| Teacher creation without valid branch | 422, no row |
| Staff creation without valid department | 422, no row |
| Staff creation without branch | 201; central staff visible to Super Admin only |
| Duplicate code for same kind | 409, no duplicate row |
| Invalid status, too-long names, missing/invalid IDs | 422, no row |
| Update nonexistent record | 404 |
| POST without or with wrong CSRF token | 403, no row |
| Create/update teacher or staff | A matching audit event is recorded; names absent from audit details |
| Change teacher/staff branch | Row moves to the correct Zone/Branch Admin's read scope |
| Record count exceeds 500 | API currently returns only first 500; pagination must be added before rollout |

## Verify in phpMyAdmin

```sql
USE learn_afghan;
SHOW TABLES LIKE '%_records';
SELECT id, code, branch_id, status FROM teacher_records ORDER BY id DESC LIMIT 20;
SELECT id, code, department_id, branch_id, status FROM staff_records ORDER BY id DESC LIMIT 20;
SELECT action, entity_type, entity_id, created_at
FROM audit_events
WHERE entity_type IN ('teacher','staff')
ORDER BY id DESC LIMIT 20;
```

**Privacy and deployment:** Display names are personnel information, even without contact fields. Do not import real employee data into this development prototype until LEARN Afghan approves the fields, role access, retention, hosting security and backups. This document records *expected test results*, not tests performed on the team's XAMPP installation.
