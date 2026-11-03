# Teacher and staff attendance (development only)

This **additive** module records attendance for existing `personnel` entries with `kind=teacher` or `kind=staff`.

## Database migration

Import `database/006_personnel_attendance.sql` into `learn_afghan` **after** `003_personnel.sql` and `005_student_attendance.sql`. Import this additional migration only once. Do not drop or reimport existing school tables. This feature does not seed real identities or records.

## Access

- Super admin: create or correct personnel attendance and view any branch.
- Zone admin: read only attendance for assigned zone.
- Branch admin: read only attendance for assigned branch.
- Department users: denied.
- One record per person and date, with `present`, `absent`, `late`, or `excused`; absent is **not** inferred from a missing record.
- Only active personnel can have a new attendance entry.
- An existing record's person/date cannot be changed. Stale edits return HTTP 409.
- Every successful write is transactional with an `audit_events` entry.
- No public enrollment, payroll calculations, medical notes, addresses, real student data, or identity documents.

## Test with synthetic data

1. In the development dashboard, open **Teacher Attendance** or **Staff Attendance**.
2. Choose a date, add a fictional person's attendance, and verify it persists after refresh.
3. Correct the status and verify the audit history.
4. Verify zone and branch accounts see only permitted records and cannot edit them.
5. Check migration `006` on the local read-only setup checker.

GitHub Actions uses temporary MySQL and synthetic fixtures: `tests/personnel-attendance-integration.cjs` and `tests/personnel-attendance-browser.cjs`. These scripts are **not for use against a populated school database**. Run the local XAMPP acceptance test only after independent code review and backup.

**Before production:** approve attendance policies, date/timezone policy, staff privacy retention, role access, database backups/recovery, HTTPS and deployment procedures. Payroll remains a separate future module.
