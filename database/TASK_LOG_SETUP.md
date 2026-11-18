# Task Log (development)

Task Log is a separate sidebar section. Every active authenticated account can create tasks and edit its own tasks. The author is set from the server session, never from submitted form data.

Super admins can view all tasks; zone admins can view tasks belonging to accounts in their zone (including accounts assigned directly to that zone without a branch); branch admins can view their branch's tasks. Other users see their own tasks. All users, including super admins, edit only their own entries. Ownership follows the user's current branch/zone assignment. This release does not add task assignment, reviewer feedback, deletion or new login roles.

Fields: task date, title, description, optional deadline, status (Not Started / In Progress / Completed), progress notes. Saves use CSRF protection, version checks and a transaction that also writes the audit event. A failed audit rolls back the task change. Search and status filters cover the latest 500 authorized entries; the page indicates when more exist.

## Local XAMPP setup

1. Back up your database before applying a schema change.
2. Pull this feature's code into the local project.
3. With approval to update that local database, select `learn_afghan` in phpMyAdmin and import `database/007_task_log.sql`, after migrations 001–006. The base schema is `schema.sql`.
4. Refresh `check-setup.php` and confirm **Table: task_log** passes.
5. Sign in and open **Task Log**. Create a synthetic test task, edit its status, refresh the browser, and check it persists. Test scope with separate authorized accounts before using real work records.

The SQL explicitly selects `learn_afghan`. It adds one table and does not seed accounts or tasks. `CREATE TABLE IF NOT EXISTS` does not repair an incompatible existing table. GitHub updates do not apply this migration automatically, and each XAMPP computer has a separate database.

## Checks

`node tests/task-log.cjs` covers rendering, delayed responses and session cleanup. The normal GitHub Actions workflow also runs PHP syntax checks and `tests/task-log-integration.cjs` against synthetic disposable MySQL fixtures. XAMPP verification remains necessary before claiming the feature works on a user's computer.
