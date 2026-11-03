# LEARN Afghan Reports & Export — development module

This feature provides **read-only aggregate reporting** from PHP/MySQL and a formula-safe CSV export.

## Reports dashboard

Under **Reports & Export** select a date. The system queries actual records (nothing is seeded or invented) and shows:
- Zones, branches, students, teachers and staff registered in the viewer's permitted scope.
- Student status counts (active, inactive, graduated).
- Recorded student, teacher and staff attendance counts (present, absent, late, excused) for the selected day.
- One row per authorized branch with counts of students, teachers, staff and recorded attendance.

**Missing attendance does not imply absence**. Counts reflect only saved records; they are not attendance percentages or payroll figures.

## Exports

The **Download branch summary CSV** button exports branch-level aggregates **only**. It does not export student/teacher/staff names, passwords, addresses, contacts or health data. The server:
1. Requires an authenticated `super_admin`, `zone_admin`, or `branch_admin`.
2. Applies the same server-side zone/branch filters as the dashboard.
3. Validates the report date (`YYYY-MM-DD`) and blocks arbitrary SQL parameters.
4. Neutralizes potentially dangerous CSV formula prefixes.
5. Disables caching and uses a 200-branch safety limit (no silent partial export).

The export uses `backend/api/reports_export.php`, which runs the same `backend/reporting.php` SQL as the JSON summary endpoint `backend/api/reports_summary.php`.

## Dependencies

Requires schema/migrations 001–006:
`schema.sql`, `002_login_attempts.sql`, `003_personnel.sql`, `004_students.sql`, `005_student_attendance.sql`, and `006_personnel_attendance.sql`.
No new migration is required for this reporting feature.

## Validation

GitHub Actions uses **disposable MySQL fixtures** to run `tests/reports-integration.cjs` and `tests/reports-browser.cjs`. Do not run integration fixtures against a real school database.

After review, the team should verify:
- All report values come from the connected MySQL database, not the browser-only demo.
- Role-limited reports and exports do not reveal records outside scope.
- CSV exports open correctly in Excel.
- Dates and category definitions comply with approved school policies.
- Browser login/logout works after updating the local code.

This does not implement Excel `.xlsx` workbooks, PDFs, financial accounting, production backups or deployment. Obtain privacy/security and organizational approval before reporting on real people.
