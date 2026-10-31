# Students module (development only)

## Installation
Apply `database/004_students.sql` after the base schema and migrations 002 and 003.

Use the `feature/student-registry` branch (draft PR #4), which builds on draft PR #1. With your local edits preserved, fetch the repository, switch to that branch and pull with `--ff-only`. Start Apache and MySQL, use the existing `backend/config.local.php` configuration and sign in at `http://localhost/learn-afghan-school-system/index.html` (adjust the folder/port if different). The migration targets `learn_afghan`; it does not use the separate early proposal starter's database name.

## Browser acceptance test in XAMPP
1. Sign in as a local test super administrator; open **Students** under People.
2. If there are no branches, create a test zone and branch first. Use synthetic student details only.
3. Choose **Register student**, enter a unique test code, full name, branch, grade/level and status, then save. Reload the browser, return to Students and confirm the record persists.
4. Search by code/name/grade, combine branch and status filters, then clear the filters. They apply only to the first 1,000 loaded authorized records.
5. Edit the student, change the grade/status or branch and save. The code is fixed. Confirm the change after refresh and the corresponding `student.create`/`student.update` entries in Audit History.
6. Open the same record in two signed-in tabs. Save a change in one tab, then submit the older form in the other. Expect a conflict and preserved input; choose **Close and refresh latest records** before editing again.
7. Test zone/branch accounts: only students in their scope are visible and add/edit controls are absent. Department accounts cannot open the directory. Reassign a student to another branch and verify that the previous branch account loses visibility after refresh.
8. Sign out. Sign in with a different account and confirm no rows or open forms remain from the previous session.

## API
- `GET backend/api/students.php`: authenticated, scoped by role (super admin: all; zone admin: assigned zone; branch admin: assigned branch). Department users are denied.
- `POST backend/api/student_save.php`: super admin only, requires same-origin JSON request, session and `X-CSRF-Token`. Create with `student_code`, `full_name`, `branch_id` (integer), `grade_level`, `status`. Update with `id`, `version` and same non-code fields. No delete endpoint.

Examples (demonstration values only):
```json
{"student_code":"TEST-001","full_name":"Example Student","branch_id":1,"grade_level":"10","status":"active"}
```
These records are for synthetic testing only; do not enter real student information.

## Important
The student browser interface and automated behavior, API and browser tests are included. Check the exact commit's GitHub Actions run for their result. This module is NOT approved for real student data. Confirm official grade categories, permissions, retention, consent, security, backups/recovery and XAMPP behavior before production. No public self-registration endpoint or sample accounts are included in the application migrations.

