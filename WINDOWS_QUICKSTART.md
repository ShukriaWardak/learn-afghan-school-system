# LEARN Afghan — Windows/XAMPP quick start (local development only)

This helper uses the **existing** PHP/MySQL setup checker and official PHP CLI account helpers. It is **not** a production deployment or a replacement for configuring XAMPP.

## Before starting

1. Keep this repository in `C:\xampp\htdocs\learn_afghan_school\learn-afghan-school-system` (or another folder under `C:\xampp\htdocs`).
2. In XAMPP Control Panel, start **Apache** and **MySQL**. The project requires PHP 8.1+ and PDO MySQL.
3. Confirm the database `learn_afghan` is available. For a **new empty database only**, apply `database/schema.sql` and migrations 002, 003, 004, 005 and 006 **in order**. These add the registries and both attendance tables (10 tables total). Inspect existing tables/data before applying a missing migration.
4. Copy `backend/config.example.php` to `backend/config.local.php` (if missing) and enter the actual **local database user** credentials. This file is ignored by Git; **never commit real passwords or personal records**.

## One-click checks and optional admin setup

Double-click **`RUN_LOCAL_SETUP.cmd`** in the project root. If Windows blocks scripts because of security policy, review the script `tools/setup-windows.ps1` and use an authorized PowerShell session under your organization's policy; do not disable system-wide security settings.

The helper automatically:
- Runs the project's **read-only** check for PHP, PDO, database connection, all required tables/columns, and admin account state.
- Explains any failed setup checks.
- If no first super administrator exists, **asks for explicit confirmation** before creating one using `backend/cli/first_admin.php`.
- If an active admin already exists, **asks for explicit confirmation** before starting the existing authorized login-reset CLI helper. Neither routine prints passwords.
- Rechecks the setup and opens the local dashboard or diagnostics page.

It **does not** automatically import SQL, delete records, modify the database schema, merge branches, push Git commits, or create accounts without consent.

## Open in Chrome

Given the nested folder above:

- [Setup checker](http://localhost/learn_afghan_school/learn-afghan-school-system/check-setup.php)
- [Dashboard](http://localhost/learn_afghan_school/learn-afghan-school-system/index.html)
- [phpMyAdmin](http://localhost/phpmyadmin/)

These `localhost` pages only work from the computer running XAMPP.

## First smoke test

After a successful authorized sign-in, use **synthetic data only**:
1. Add a test zone and branch; reload and confirm they remain.
2. Add a test department; register synthetic teacher/staff/student records; reload and confirm.
3. Check Audit History, role restrictions, and available CSV/report functions.
4. Do not use real student or employee personal information until security review, approved permissions, backups, HTTPS, deployment testing, and organizational sign-off are complete.

### Troubleshooting

- **PHP or PDO fails:** update/configure the PHP version used by XAMPP and Apache; enable PDO MySQL.
- **Connection fails:** verify MySQL is running and `backend/config.local.php` has correct host, port, database, username and password.
- **Table fails:** verify each migration in phpMyAdmin and inspect the missing columns; do not drop existing tables.
- **Administrator fails:** create the first admin only for an empty admin installation; for an existing account, use the repo's CLI recovery helper with authorization.

## What this does not implement

Finance, payroll, health and other departmental forms, general departmental/financial approvals, automatic backups, PDF/Excel reports, MFA, and production deployment still need development and review. Student/personnel attendance, aggregate reports and branch approvals are available on the working branch; see [PROJECT_STATUS.md](PROJECT_STATUS.md) for exact scope and verification limits.

