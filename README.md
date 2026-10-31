# LEARN Afghan — Central Administration

This development branch (`feature/student-registry`, draft PR #4) adds the student registry to the PHP/MySQL administrative dashboard in draft PR #1. It is not merged into `main` and has not passed the team's end-to-end XAMPP testing.

## Current progress

| Area | Code available on this branch | Verification / remaining work |
| --- | --- | --- |
| Interface | Dashboard, navigation, search and zone filters | Browser interaction testing pending |
| Database foundation | zones, branches, departments, users, audit_events, login_attempts | Verify both SQL imports in local MySQL |
| Authentication | Sign-in, sign-out, sessions, CSRF and login throttling | Local login and role-boundary tests pending |
| Zone / branch administration | Scoped listings; super-admin zone/branch creation and branch editing | Verify database persistence and audit rows |
| Users | Super-admin read-only directory, first 200 accounts | Invitations, editing, reset and MFA are not implemented |
| Audit | Transactional logs for zone/branch writes; recent 100 events | Verify against a running database |
| CSV | Authorized branch export; branch-page search/zone filters; formula neutralization | Export helper checks passed; browser download testing pending |
| Reports | Signed-in branch status totals, zone breakdown and authorized CSV download | Isolated report checks passed; browser/MySQL integration pending |
| Departments | Super-admin directory, create and rename; transactional audit events | Uses existing departments table; parent assignments preserved |
| Teachers / Staff | Scoped directories, search/status filters, super-admin create/edit/inactivate, stale-edit protection | Requires migration 003; personnel records do not create login accounts |
| Branch admins | Super-admin read-only directory of branch-admin accounts | Account provisioning/editing still pending |
| Students | Scoped directory, code/name/grade search, branch/status filters, super-admin registration/editing, conflict recovery and audit logging | Requires migration 004; automated API and browser tests are included; XAMPP verification pending |
| Other modules | Planning screens | Finance, health and approvals are not implemented |
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
git switch feature/student-registry
git pull --ff-only origin feature/student-registry
```

1. Start Apache and MySQL in XAMPP (PHP 8.1+).
2. For a fresh database, import `database/schema.sql`, then `database/002_login_attempts.sql`. If already imported, check that the six tables above exist before repeating setup.
3. Copy `backend/config.example.php` to `backend/config.local.php` and configure a restricted local database account. Never commit this file.
4. Use an authorized local test account. For an empty installation, follow the CLI first-admin instructions in [backend/README.md](backend/README.md).
5. If the folder is named `learn-afghan-school-system`, open **http://localhost/learn-afghan-school-system/index.html**. Adjust the folder name if necessary.
6. Sign in. With an empty database, zero zones/branches is expected. Add a test zone, add a test branch, edit it, reload, and verify audit history using disposable local data.

### Departments, teachers and staff

Import `database/003_personnel.sql` after the first two SQL files. This migration adds the personnel table without replacing existing tables or records. It is also required for existing installations upgrading to these modules.

As a super administrator, open **Departments**, add an approved code/name, then open **Teachers** or **Staff & HR**. Add a record with a unique code, full name, branch, department, job title and status. Codes and record type remain fixed after creation. Edit a record to change its assignment or mark it inactive; no deletion is implemented. Existing department parent assignments are displayed and preserved; editing the hierarchy is not implemented.

Zone and branch administrators can read personnel only within their assigned zone or branch. Department users have no personnel access yet. Only super administrators can write records or view the central department and branch-admin directories. Staff records are separate from login accounts, and this first registry does not include payroll, attendance, contact details or identity documents. The personnel and branch-admin directories display at most 1,000 records; filters search those loaded records.

Run `node tests/registry.cjs` for isolated directory checks. The GitHub Actions integration job creates a disposable MySQL database and checks creation, editing, duplicate/invalid input, stale edits, CSRF, role boundaries, audit events and logout through the PHP APIs. `tests/setup-integration.php` refuses an existing database and is for disposable CI only. Check the workflow result for the exact commit before treating integration tests as passed.

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

