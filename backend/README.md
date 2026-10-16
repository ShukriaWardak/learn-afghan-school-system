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

## Phase 4 API and first-admin setup

Read endpoints require a valid session:

| Endpoint | Permission | Function |
| --- | --- | --- |
| `GET api/zones.php` | super / assigned zone / assigned branch | Scoped zones |
| `GET api/branches.php` | super / assigned zone / assigned branch | Scoped branches; includes active branch-admin display name |
| `GET api/users.php` | super admin only | First 200 account summaries, never password hashes |
| `GET api/audit.php` | super admin only | Latest 100 audit event summaries |
| `POST api/zone_create.php` | super admin only | Create zone; CSRF + validation + audit |
| `POST api/branch_create.php` | super admin only | Create branch in pending state; CSRF + validation + audit |
| `POST api/branch_update.php` | super admin only | Update name, zone, location and status; CSRF + validation + audit |

All POST actions expect a same-origin JSON request with `X-CSRF-Token` from a
valid session. Role enforcement is **server side**, not based on hidden frontend buttons.
Writes use SQL transactions so audit history and actual changes succeed together.

The first account must be approved and enrolled from the server command line, not through
any public web route. Run `php backend/cli/first_admin.php` with local process environment
variables `LEARN_FIRST_ADMIN_USERNAME`, `LEARN_FIRST_ADMIN_NAME` and
`LEARN_FIRST_ADMIN_PASSWORD` (>=12 bytes). There is deliberately no default password.
The helper refuses to run if a super admin already exists. Protect environment variables,
clear them promptly, and never commit any real credentials.

### Current limitations (not production ready)

- No real-world names or codes preloaded. Confirm approved zone/branch lists before entering.
- No organization-approved permission matrix for editing other departments or roles yet.
- No user invitation, password-reset or MFA flow.
- No backend CRUD for staff, finance, healthcare or student records.
- No complete report generator, encrypted off-site backup strategy or disaster recovery drill.
- Must perform end-to-end XAMPP tests, role boundary checks, authentication security review,
  input validation tests and staging deployment with HTTPS before using confidential data.
- Dedicated **public** production hosting must restrict access to `backend/config.local.php`,
  SQL dumps and CLI files, keep secrets outside the public web root, and enforce trusted-host rules.
