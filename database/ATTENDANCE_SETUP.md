# Student attendance module (development only)

This is an additive implementation of **daily attendance for registered students**. It is not a production-ready record system.

## Install after the existing schema

In the **same** local `learn_afghan` database, apply `database/005_student_attendance.sql` **once** after `schema.sql`, `002_login_attempts.sql`, `003_personnel.sql` and `004_students.sql`.

Do not re-create databases or drop tables that already contain records. A fresh disposable CI database imports all five files in order. Re-run `check-setup.php` to confirm the additional attendance table exists.

## Permissions and behavior

- `super_admin`: view and create/correct attendance records.
- `zone_admin`: read-only attendance for their assigned zone.
- `branch_admin`: read-only attendance for their assigned branch.
- `department_user`: no attendance access.
- One record per student and date, with `present`, `absent`, `late` or `excused` status.
- An existing student/date/status entry may be corrected with a version check. Student/date never change during correction.
- An unrecorded student is **not** implicitly absent. No automatic absence calculations are performed.
- Server-side authorization, CSRF checks and transactional audit events are required for every write.
- No notes, diagnoses, addresses or other sensitive free-text data are collected.

## Test only with synthetic data

1. Sign in locally with an authorized test super-admin account.
2. Create a fictional student in an approved test branch (if needed).
3. Open **Student Attendance**, choose a date, record a status, and refresh.
4. Correct it, refresh again, and confirm an audit event and the edited status.
5. Log in as test zone/branch administrators and verify records outside their assigned scope cannot be read and write controls are absent.
6. Confirm roles, approved attendance categories and retention requirements before entering real school attendance.

Automated tests:
- `node tests/attendance-integration.cjs` checks the PHP/MySQL APIs with a disposable CI fixture.
- `node tests/attendance-browser.cjs` checks the navigation, entry and edit UI in disposable Playwright CI.

The tests must not run against an existing school database. Check the latest GitHub Actions run before considering these tests passed. This change does not implement teacher attendance, HR payroll, absence notifications, or production backups.
