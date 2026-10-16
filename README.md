# LEARN Afghan — Central Database (Super Admin UI)

This repository contains an **early, browser-only interface prototype** for LEARN Afghan's proposed centralized administrative database.

## Local preview (VS Code / XAMPP)
1. Open this repository's folder in VS Code.
2. Open `index.html` in a browser, or use VS Code's Live Server extension.
3. Alternatively, if hosted inside XAMPP's `htdocs`, start Apache and open the appropriate localhost URL.

## What works in the demo
- Responsive dashboard with navigable sidebar
- Navigation for zones, 25 branch records, administrators, teachers, staff, departments, reporting and audit planning
- Search/filter branch records
- Local demonstration edits to branch names, zone assignment, assigned admin and status
- CSV export of the demo branch registry

**Demo storage:** Edits are saved in the **current browser's localStorage only**. The branch names, zone assignments, statuses and metrics are placeholder values, **not authoritative LEARN Afghan records**.

## Not yet implemented
- Secure authentication, live role-based permissions and authorization
- Backend / shared database (PHP/MySQL or other stack still to be confirmed)
- Server-side validated forms, duplicate controls and approval workflow
- Audit history written on the server
- Real Excel/PDF report generation
- Scheduled server backups and tested recovery
- Formal user data, official branch names/codes, 3 zone definitions and department-specific required fields

**Do not enter real personal, student, HR, health or financial data into this demo.** Never add database passwords, API keys or private data to a public GitHub repository.

## VS Code + GitHub sync
After changes are committed to the remote main branch, update your local clone:

```bash
git status
git pull origin main
```

If `git status` shows local modifications, save/commit or otherwise handle them before pulling.

## Scope
Based on the *LEARN Afghan Central Database Development Proposal*: a secure centralized system for three zones, 25 branches, departments, forms, access controls, approved reporting and backups. Phase 1 prioritizes administrative data entry rather than advanced school-management features.

## Phase 2: PHP/MySQL groundwork
The repository now includes `database/schema.sql` and a separate `backend/` with configuration template and read-only session-protected branch API. This is scaffolding only: authentication, real user accounts, real data, approvals, server auditing, and secure deployment are **not yet implemented**. See [backend/README.md](backend/README.md). Do not enter confidential data into the browser demo.

## Phase 3: authentication foundation
The backend now includes `backend/api/login.php`, `logout.php`, `csrf.php`, `session.php`, and authorization checks for the branch list. Apply `database/002_login_attempts.sql` after the main schema. These endpoints have **not yet been tested in a running XAMPP installation**, and the frontend is **not connected**. No real accounts are pre-created. See [backend setup](backend/README.md). Do not deploy or enter real personal data until security work and testing are completed.

## Phase 4: authenticated administrative workflow (feature branch)

This branch introduces a real, **opt-in local-server path** while retaining the clearly marked
browser-only prototype for `file://` and hosts with no PHP backend:

- Authenticated sign-in, sign-out, session restoration and client-side loading protection.
- Zone and branch listings fetched from PHP/MySQL and scoped on the **server** by role.
- Super-admin-only creation of approved zones/branches and editing existing branch records.
- CSRF protection, field validation and server audit rows for these writes.
- Read-only user directory (first 200 users) and audit log (last 100 events), visible only to super admins.
- Scoped CSV export of the authorized branch list.
- Syntax-check workflow and CLI-only first-admin enrollment helper.

**Important:** Live mode is not a completed production system. It is enabled only if a compatible
PHP backend responds. A missing or unconfigured backend is *not* silently treated as a live database.
Official zone/branch records are never seeded from the placeholder demo. There is no default account.
Staff/HR, student, healthcare, finance, approvals, report generation, user lifecycle, backups and
recovery remain unimplemented. Do not upload real confidential information until security review,
testing and organizational sign-off.

### Quick local setup

1. Use PHP 8.1+ with XAMPP (or a comparable Apache + MySQL/MariaDB stack).
2. Import `database/schema.sql` and then `database/002_login_attempts.sql`.
3. Create a restricted MySQL application user with only required privileges.
4. Copy `backend/config.example.php` to `backend/config.local.php`, fill in local-only credentials,
   and keep that local file out of Git.
5. An **authorized owner** must create the first super-admin account. The CLI-only
   `backend/cli/first_admin.php` script accepts `LEARN_FIRST_ADMIN_USERNAME`,
   `LEARN_FIRST_ADMIN_NAME` and `LEARN_FIRST_ADMIN_PASSWORD` from the local process environment;
   the password must be at least 12 bytes long. Clear those variables after running
   `php backend/cli/first_admin.php`. Do not type secrets into repository files or commit them.
6. Start Apache and MySQL, then open the project through `http://localhost/<folder>/index.html`.
   Logging in will display only actual database records (possibly zero if not yet entered).

Super admin can first add approved zones, then branches, through the authenticated dashboard.
See [backend setup and API details](backend/README.md).

### Verification status

JavaScript syntax was checked while developing this branch. A GitHub Actions workflow is provided
for JS/PHP syntax linting. **Full login, database migrations, role-scope checks, audit writes and
browser interactions must be exercised against a running local MySQL/PHP instance** before merge
or use with operational data.
