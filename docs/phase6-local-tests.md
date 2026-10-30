# Phase 6: Department management and audit history — local tests

Development only. Test in XAMPP with dedicated test accounts and approved organizational names/codes. Do **not** enter real student, health, salary, or other confidential records.

## No new SQL import
The existing `database/schema.sql` already creates both `departments` and `audit_events`. Use the existing **`learn_afghan`** database.

## Code checks (PowerShell in project folder)
```powershell
C:\xampp\php\php.exe -l backend\api\departments.php
C:\xampp\php\php.exe -l backend\api\audit.php
C:\xampp\php\php.exe -l backend\management.php
```

## Tests

| Test | Expected |
| --- | --- |
| Unauthenticated GET `backend/api/departments.php` | HTTP 401 |
| Zone Admin GET or POST `backend/api/departments.php` | HTTP 403 |
| Super Admin creates approved department code/name | HTTP 201; department appears in directory |
| Create same department code twice | HTTP 409; no duplicate or audit event |
| Update approved department | HTTP 200, name/code changes |
| Invalid department code or oversized name | HTTP 422; no write |
| POST without CSRF header | HTTP 403; no write |
| Super Admin GET `backend/api/audit.php` | 0–50 latest zone/branch/department events |
| Unauthorized GET `backend/api/audit.php` | HTTP 401 or 403, no audit data |
| Create/edit a zone, branch, or department | Audit history displays action, actor, record type, server timestamp |
| Existing department has parent_id assigned | Editing preserves its parent assignment |

## Manual verification
Open phpMyAdmin SQL tab in the `learn_afghan` database:
```sql
SELECT id, code, name, parent_id FROM departments ORDER BY id DESC;
SELECT id, actor_user_id, action, entity_type, entity_id, created_at
FROM audit_events ORDER BY id DESC LIMIT 20;
```

Audit detail JSON is intentionally *not* returned by the audit list API. Deletion, hierarchy editing, account management, and production deployment are out of scope.

**Important:** This is a test plan, not proof of completed XAMPP or security testing. Record actual results with teammates before merging.
