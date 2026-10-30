# PHP / MySQL backend — development foundation

The root `index.html` remains a **localStorage-only, unauthenticated visual demo** and is **not connected** to these endpoints. Do not store real organization, student, staff, financial or healthcare records in the demo.

## Set up in XAMPP (local only)
1. Start Apache and MySQL/MariaDB. PHP 8.1+ is required.
2. Import `database/schema.sql`, then `database/002_login_attempts.sql`.
3. Create a restricted MySQL user for the application and grant only necessary privileges (not root).
4. Copy `backend/config.example.php` to `backend/config.local.php` and add the local credentials. Keep the real file out of Git.
5. Create **authorized** accounts in MySQL with PHP-generated `password_hash($password, PASSWORD_DEFAULT)` hashes. Do not commit default accounts or passwords.
6. Open the project from `http://localhost/...`, not by opening the HTML directly if testing PHP APIs.

## Authentication endpoints
- GET `backend/api/csrf.php`: creates session and returns CSRF token.
- POST `backend/api/login.php`: JSON `{"username":"...","password":"..."}` with `X-CSRF-Token` header and same-origin request; responds with user data and fresh CSRF token.
- GET `backend/api/session.php`: returns current account or HTTP 401.
- POST `backend/api/logout.php`: requires CSRF token and clears session.
- GET `backend/api/branches.php`: requires authenticated user; query is scoped by role and assigned zone/branch.

Login failures are stored in `login_attempts` for basic throttling. Remove old login-attempt records on a schedule.

## Still required before production
- **Do not deploy yet.** Review all access controls, require HTTPS, add secure trusted-host verification, configure error logs and privacy-safe monitoring.
- Create a first-admin enrollment process that requires administrative approval; protect any administrative account creation.
- Apply strong password rules, account recovery policy, password rehashing, login attempt retention and session expiration.
- Implement server-side form validation, per-operation permission matrix, CSRF protection for every state-changing action, audit inserts, backups/recovery tests, and approved reporting.
- Configure database credentials outside public web root in production; perform threat modeling and security tests.
- Official zone names/codes, branch names/codes, department records and form fields must be approved.
- GitHub Pages **cannot run PHP or MySQL**.

## Phase 4 — connected sign-in and branch viewing (development-only)
- The separate `/portal.html` is a read-only PHP/MySQL integration preview. The original `/index.html` is still a browser demo and is **not an authenticated production dashboard**.
- Download or clone the full repository into `C:\\xampp\\htdocs\\learn-afghan-school-system` (adjust the path if your XAMPP directory differs).
- In XAMPP start Apache and MySQL. In phpMyAdmin import `database/schema.sql` and then `database/002_login_attempts.sql`. **Both scripts use `learn_afghan`**, not `learn_afghan_school_system`.
- Use a dedicated **local development** MySQL account with only the privileges needed by these endpoints and setup (not MySQL root). One example for an *authorized local database administrator* to adapt in phpMyAdmin's SQL tab (choose your own strong password; do not publish it):

```sql
CREATE USER 'learn_app'@'127.0.0.1' IDENTIFIED BY 'CHOOSE_A_UNIQUE_LOCAL_PASSWORD';
GRANT SELECT, INSERT ON learn_afghan.* TO 'learn_app'@'127.0.0.1';
```

- Copy `backend/config.example.php` to `backend/config.local.php`, with the local MySQL username, password and database `learn_afghan`. `config.local.php` is Git-ignored; **never commit it**. The `config.example.php` host is `127.0.0.1`, matching the example account above. If you instead choose `localhost`, configure the corresponding database host and grants consistently.
- The first local super admin must be authorized by the team. The optional CLI-only script refuses HTTP requests and refuses to create a new account if *any* user exists:

```powershell
cd C:\xampp\htdocs\learn-afghan-school-system
C:\xampp\php\php.exe backend\scripts\create_first_admin.php --development-only
```

  The password may be **visible while you type it** in the terminal: use a private terminal and a **unique test password** of at least 12 characters. Never use a personal or production password. This script is for local setup only; exclude it from production deployment.
- Visit `http://localhost/learn-afghan-school-system/portal.html`. Sign in, then inspect the read-only branch list. If no official branch or zone records have been approved and inserted, the correct result is an **empty directory**—not 25 fictitious rows.
- To verify authorization, sign out and confirm that `backend/api/branches.php` returns HTTP 401 when opened without a valid session. Also test on the intended PHP/XAMPP installation before considering rollout.

**Limitations:** Not a production release. No server-authorized forms, exports, audit logging for changes, secure hosting, approved data, recovery workflow, or comprehensive security testing. The branch directory is read-only. The real dashboard is not yet integrated with the API.
