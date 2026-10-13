# PHP/MySQL backend foundation
The existing index.html / app.js remains a browser-only demo. These PHP endpoints are not yet connected to it.

## Local setup with XAMPP
1. Import database/schema.sql into local MySQL/MariaDB.
2. Create a dedicated low-privilege database user, not root.
3. Copy backend/config.example.php to backend/config.local.php, fill in credentials. This is gitignored.
4. Run Apache and MySQL in XAMPP.

Endpoints backend/api/branches.php and backend/api/session.php deliberately return HTTP 401 without an authenticated session. No login has been implemented yet.

## Before any real deployment
Implement password_hash/password_verify authentication, CSRF protection, session regeneration, role validation against DB on every request, login rate limiting, authorization, audit logging, backups, HTTPS and server-side validation. Confirm real zones/branches/departments and data fields with administration before importing personal information. Do not use GitHub Pages for a PHP backend. Do not commit confidential data, secrets or live database dumps.
