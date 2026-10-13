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
