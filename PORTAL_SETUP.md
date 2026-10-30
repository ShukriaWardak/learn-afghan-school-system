# Secure branch portal (development)

The team's existing `index.html` is still an **unconnected demonstration interface**. The new `portal.html` is a separate authenticated, read-only test page that calls the existing PHP API:

- `GET backend/api/session.php` (restore authorized session)
- `GET backend/api/csrf.php` and `POST backend/api/login.php` (sign in)
- `GET backend/api/branches.php` (role-scoped branch list)
- `POST backend/api/logout.php` (sign out)

The frontend creates table cells using `textContent`, not `innerHTML`, and stores neither credentials nor branch data in localStorage. Branch records are only fetched after the server confirms an authenticated session. This is **not a finished production application**.

## Local XAMPP setup

1. Place or clone the repository at `C:\xampp\htdocs\learn-afghan-school-system`. In XAMPP, start **Apache** and **MySQL**.
2. In phpMyAdmin, import `database/schema.sql` and then `database/002_login_attempts.sql`. **Important:** these scripts use the database name `learn_afghan`, not `learn_afghan_school_system`.
3. Create a dedicated, least-privileged MySQL application account (not MySQL `root`), then copy `backend/config.example.php` to `backend/config.local.php` and fill in the local database connection settings. Keep `config.local.php` private and out of Git.
4. An authorized administrator must provision a test login in the `users` table with a hash produced by PHP's `password_hash(..., PASSWORD_DEFAULT)`. Do not store plaintext passwords, commit credentials, or invent official school records.
5. Open `http://localhost/learn-afghan-school-system/portal.html` **through Apache** (not as a `file://` page or with a Live Server-only port), then sign in.
6. Branches shown depend on the logged-in user's role and assigned zone/branch. An empty list is expected if no approved branch records are populated.

## Troubleshooting

- **404 on PHP endpoints:** Verify the repository is inside XAMPP `htdocs` and Apache is running.
- **503 / Database is not configured:** Check the private `backend/config.local.php`.
- **401 / Authentication required:** This is normal before login or when the session expires.
- **403 on branch list:** The role or zone/branch assignment does not authorize that directory.
- **Empty directory:** Add only approved/non-confidential test records and valid assignments to the local database.

## Security and release status

This branch is for peer review and local testing. It does not connect the original demo to the backend, enable editing, or supply real user accounts. **Do not deploy or enter confidential records** until account onboarding, authorization, database access controls, HTTPS, logging, retention, and the complete security test plan have been reviewed and approved.
