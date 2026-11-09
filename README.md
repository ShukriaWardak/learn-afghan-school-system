# LEARN Afghan — Central Administration

This working branch (`feature/branch-approvals-2026-11-04`) includes the branded login, student/personnel registries, both attendance modules, aggregate reports, Windows setup helper and pending branch approvals. It builds on the stacked draft PRs and is not merged into `main`. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the remaining sections and [database/APPROVALS_SETUP.md](database/APPROVALS_SETUP.md) for the new review queue. The team's end-to-end XAMPP acceptance remains unverified.

## Current progress

| Area | Code available on this branch | Verification / remaining work |
| --- | --- | --- |
| Interface | Dashboard, navigation, search and zone filters | Browser interaction testing pending |
| Database foundation | zones, branches, departments, users, audit_events, login_attempts | Verify both SQL imports in local MySQL |
| Authentication | Sign-in, sign-out, sessions, CSRF and login throttling | Local login and role-boundary tests pending |
| Local setup | Browser/CLI checks for PHP, driver, configuration, connection, tables/columns and administrator readiness; readable sign-in/setup cards | Read-only and restricted to localhost for browser access; see LOCAL_SETUP.md |
| Zone / branch administration | Scoped listings; super-admin zone/branch creation and branch editing | Verify database persistence and audit rows |
| Users | Super-admin read-only directory, first 200 accounts | Invitations, editing, reset and MFA are not implemented |
| Audit | Transactional logs for zone/branch writes; recent 100 events | Verify against a running database |
| CSV | Authorized branch export; branch-page search/zone filters; formula neutralization | Export helper checks passed; browser download testing pending |
| Reports | Live scoped school/branch metrics, student/personnel status and attendance summary by date, aggregate CSV | Requires existing migrations 001–006; automated CI and local acceptance testing pending |
| Branch approvals | Super-admin pending queue, approve/reject, review notes/history and stale-review protection with transactional audit | Uses existing branch/audit tables; departmental and financial approvals remain planned |
| Departments | Super-admin directory, create and rename; transactional audit events | Uses existing departments table; parent assignments preserved |
| Teachers / Staff | Scoped directories, search/status filters, super-admin create/edit/inactivate, stale-edit protection | Requires migration 003; personnel records do not create login accounts |
| Branch admins | Super-admin read-only directory of branch-admin accounts | Account provisioning/editing still pending |
| Students | Scoped directory, code/name/grade search, branch/status filters, super-admin registration/editing, conflict recovery and audit logging | Requires migration 004; automated API and browser tests are included; XAMPP verification pending |
| Student attendance | Daily read/write registry with role-scoped reads, super-admin audited updates, and date/status filters | Requires migration 005; CI passed in PR #7; XAMPP confirmation pending |
| Teacher/staff attendance | Daily role-scoped teacher and staff attendance with audited super-admin writes and conflict checks | Requires migration 006; CI and XAMPP confirmation pending |
| Other modules | Planning screens | Finance, payroll, health and other department-specific forms are not implemented |
| Operations | Setup instructions and syntax-check workflow | PDF/Excel reporting, backups/recovery and production readiness remain |

The proposal targets **3 zones and 25 branches**. These are planned scope, not verified live counts. No official zone/branch records or default accounts are seeded. The dashboard's live counts reflect only records accessible to the signed-in account.

## View the current result locally

Use the existing project folder in XAMPP's `htdocs`. In that folder, first run:

```bash
git status
```

If there are local edits, commit or otherwise preserve them before switching branches. Then run:

```bash
git fetch origin
git switch feature/branch-approvals-2026-11-04
git pull --ff-only origin feature/branch-approvals-2026-11-04
```

1. Start Apache and MySQL in XAMPP (PHP 8.1+).
2. For a new empty installation, apply `database/schema.sql`, then migrations `002_login_attempts.sql`, `003_personnel.sql`, `004_students.sql`, `005_student_attendance.sql` and `006_personnel_attendance.sql` in order. Inspect an existing installation and its data before applying any missing migration; the full schema has 10 tables.
3. Copy `backend/config.example.php` to `backend/config.local.php` and configure a restricted local database account. Never commit this file.
4. Use an authorized local test account. For an empty installation, follow the CLI first-admin instructions in [backend/README.md](backend/README.md).
5. If the folder is named `learn-afghan-school-system`, open **http://localhost/learn-afghan-school-system/index.html**. Adjust the folder name if necessary.
6. Sign in. With an empty database, zero zones/branches is expected. Add a test zone, add a test branch, edit it, reload, and verify audit history using disposable local data.

If setup or login is blocked, open `check-setup.php` using the same folder URL as `index.html`. It shows the project directory being served and identifies missing setup steps, without displaying credentials or changing records. It can run on PHP 8.0 to explain the app's PHP 8.1 requirement. See [LOCAL_SETUP.md](LOCAL_SETUP.md) for Windows/macOS instructions. An existing administrator detected by this page still needs to be tested with the correct sign-in credentials.

### Departments, teachers and staff

Import `database/003_personnel.sql` after the first two SQL files. This migration adds the personnel table without replacing existing tables or records. It is also required for existing installations upgrading to these modules.

As a super administrator, open **Departments**, add an approved code/name, then open **Teachers** or **Staff & HR**. Add a record with a unique code, full name, branch, department, job title and status. Codes and record type remain fixed after creation. Edit a record to change its assignment or mark it inactive; no deletion is implemented. Existing department parent assignments are displayed and preserved; editing the hierarchy is not implemented.

Zone and branch administrators can read personnel only within their assigned zone or branch. Department users have no personnel access yet. Only super administrators can write records or view the central department and branch-admin directories. Staff records are separate from login accounts, and this first registry does not include payroll, attendance, contact details or identity documents. The personnel and branch-admin directories display at most 1,000 records; filters search those loaded records.

Run `node tests/registry.cjs` for isolated directory checks. The GitHub Actions integration job creates a disposable MySQL database and checks creation, editing, duplicate/invalid input, stale edits, CSRF, role boundaries, audit events and logout through the PHP APIs. `tests/setup-integration.php` refuses an existing database and is for disposable CI only. Check the workflow result for the exact commit before treating integration tests as passed.

### Reports & Export

**Reports & Export** now shows authorized aggregate student, teacher, staff, attendance and branch statistics, with a selectable report date and downloadable branch-aggregate CSV. No individual student/staff names are included in that export. Zone/branch roles have server-scoped results; department users are denied. CSV cells are hardened against spreadsheet formulas and export fails rather than silently truncating more than 200 branches. See [database/REPORTING_SETUP.md](database/REPORTING_SETUP.md). This is a development feature and requires review and CI/local checks before production use.

### Branch approvals

**Approvals** now lists pending branches for super-administrator review. Approval sets a branch active; rejection sets it inactive and requires a review note. Both the status change and decision audit entry commit together. A branch changed since the review was opened is refused, with an explicit refresh action. Recent decisions include reviewer and note. This queue uses existing super-admin permissions; it does not establish general departmental or two-person approval rules. See [database/APPROVALS_SETUP.md](database/APPROVALS_SETUP.md).

### Teacher and staff attendance

Install `database/006_personnel_attendance.sql` after migration 005. It adds daily attendance for staff and teachers already registered in the personnel directory. Super administrators may create/correct entries; zone/branch accounts have scoped read-only access, and department accounts are denied. The interface distinguishes present, absent, late, and excused entries, with uniqueness, optimistic version checks, audit logs and no implicit absences. See [database/PERSONNEL_ATTENDANCE_SETUP.md](database/PERSONNEL_ATTENDANCE_SETUP.md) and validate in disposable CI and locally before introducing real data. Payroll remains unimplemented.

### Student attendance

After migrations 001–004, import `database/005_student_attendance.sql` (additive) into the same `learn_afghan` database. Signed-in users with student-directory permissions can view attendance within their zone/branch scopes. Only super administrators can create or correct records. This module has one status per student and date (present/absent/late/excused), uniqueness checks, version conflict protection and transactional audit records. See [database/ATTENDANCE_SETUP.md](database/ATTENDANCE_SETUP.md) before testing; use synthetic records only. GitHub CI is not a substitute for local/production approval.

### Students

Import `database/004_students.sql` into the existing `learn_afghan` database after migrations 002 and 003. Then sign in and open **Students** in the People navigation group. Super administrators can register a student with a unique code, full name, branch, grade/level and active/inactive/graduated status. The student code remains fixed after registration. Zone and branch administrators have read-only access within their assigned scope; department users are denied.

Search, branch and status filters operate on up to 1,000 loaded authorized records. Refresh retrieves newer changes. Editing sends the version that was loaded; conflicting changes leave the form open with its unsaved input and an explicit **Close and refresh latest records** action. No delete or public self-registration is implemented. Student data is cleared from the directory on sign-out/session expiry and is never written to localStorage.

See [database/STUDENTS_SETUP.md](database/STUDENTS_SETUP.md) for a short XAMPP acceptance test. `node tests/students.cjs` checks isolated directory behavior. CI adds real MySQL/PHP student API tests, including audit-failure rollback, followed by Playwright browser tests for registration, reload, editing, conflicts, filters and role limits. These CI checks use a disposable database and synthetic records; do not run the fixture/fault-injection scripts against a working installation.

Opening `index.html` directly via `file://` shows a separately labelled browser-only demo. Demo edits use localStorage and do not populate MySQL. GitHub displays source code; it is not a running PHP/MySQL service.

## Local verification checklist

- Successful login, incorrect-password response, sign-out and subsequent blocked API access.
- Super admin creates a zone and branch, edits branch status, and sees changes after reload.
- Each successful write has a corresponding audit event.
- Duplicate codes and invalid fields are rejected.
- Zone/branch accounts cannot read outside their assigned scope or call super-admin write APIs.
- Search and zone filters match CSV rows; no-match exports contain the header only.
- User and audit pages remain restricted to super admins.

Check the GitHub Actions result for the exact commit for JavaScript/PHP syntax, isolated behavior, MySQL/PHP integration and browser-test results. The team's XAMPP installation and production deployment remain unverified. Do not confuse an automated CI pass with a tested deployment.

## Project scope and remaining inputs

The agreed direction is a centralized administrative database for three zones and 25 branches. Official names/codes, department fields, permission rules and reporting formats still need organizational confirmation. Production hosting, security review, backups and recovery remain unfinished. Use disposable test data until those requirements are met.

