# Coding agent guidance — LEARN Afghan School Management System

This repository is a **development prototype**, not an approved production information system. Use these instructions when reviewing, implementing or testing changes via OpenAI Codex, VS Code or other coding tools.

## Architecture

- The frontend is plain HTML, CSS and JavaScript: `index.html`, `app.js`, `live.js`, `registry.js`, `students.js`, `styles.css`, `dashboard-theme.css`, `reference-layout.css`, `login-theme.css`.
- The authenticated backend uses PHP endpoints under `backend/api/`, including `login.php`, `session.php`, `logout.php`, zones, branches, departments, personnel and students.
- MySQL schema and migrations are in `database/`: `schema.sql`, `002_login_attempts.sql`, `003_personnel.sql`, `004_students.sql`.
- The local, gitignored credentials file is `backend/config.local.php`; see `backend/config.example.php` for the template.
- The branded split-screen sign-in is rendered by `Live.showLogin()` in `live.js` and styled by `login-theme.css`. Preserve the existing username/password form IDs and `csrf.php` / `login.php` authentication contract. Do not replace authentication with localStorage or hardcoded credentials.

## Safety and approvals

1. **Never** introduce default passwords, fake production accounts, secret tokens, or credentials in source control. Never print, send, commit or request the contents of `backend/config.local.php`.
2. Never use authentic student, teacher or employee records in tests. Use synthetic fixtures and a disposable database only.
3. Do not run destructive database operations, reset a working database, apply migrations to a populated database, or create/reset a real admin account without explicit user approval.
4. Do not push, merge, force-push, publish or deploy without approval. Develop changes in a dedicated branch, summarize diffs and verify tests before proposing a PR.
5. Treat unsupervised GitHub demo pages as source code, not as a working PHP/MySQL host. Opening `index.html` with `file://` is a browser-only demo.
6. Do not imply functionality is complete until verified locally in XAMPP and reviewed for security, role permissions, backups and organizational approval.
7. Keep the actual site's login restricted to approved administrative accounts. Do not add public registration or browser-based password reset casually.

## Local workflow (Windows XAMPP)

- Project root: `C:\xampp\htdocs\learn_afghan_school\learn-afghan-school-system`.
- Start Apache and MySQL in XAMPP. PHP 8.1+ with `pdo_mysql` is required.
- Project diagnostic page: `http://localhost/learn_afghan_school/learn-afghan-school-system/check-setup.php`.
- Dashboard: `http://localhost/learn_afghan_school/learn-afghan-school-system/index.html`.
- The localhost links are available only on the user's computer. Agents in remote environments must not claim to have verified local XAMPP without real evidence.
- Account bootstrap, when explicitly authorized and needed, uses the existing **CLI-only** `backend/cli/first_admin.php`; existing authorized login recovery uses `reset-local-login.php`.

## Basic checks before proposing changes

- `node --check app.js`
- `node --check live.js`
- `node --check registry.js`
- `node --check students.js`
- `node tests/branch-export.cjs`
- `node tests/live-reports.cjs`
- `node tests/registry.cjs`
- `node tests/students.cjs`
- `php -l` for modified PHP files.

CI integration/browser tests use disposable fixtures with `LEARN_INTEGRATION_TEST=1`. **Never run `tests/setup-integration.php` against an existing local school database.** The Playwright browser suite in `tests/students-browser.cjs` also checks the branded login page.

## Project priorities

1. Ensure new branded login stays responsive and secure; verify successful/failed login, logout, and keyboard/screen-reader accessibility.
2. Confirm XAMPP + MySQL migrations, first authorized super admin and persistence of synthetic zone/branch/student/teacher/staff records.
3. Review backend role boundaries, audit transactions, CSRF, stale-edit protection, CSV export safety, and browser errors.
4. Plan (do not claim implemented): finance, payroll, attendance, approvals, health, backup and recovery, production deployment.

If requirements are unclear, preserve working behavior and propose an incremental plan rather than guessing official school policy or real account details.
