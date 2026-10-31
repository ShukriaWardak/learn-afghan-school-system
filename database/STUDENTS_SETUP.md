# Students module (development only)

## Installation
Apply `database/004_students.sql` after the base schema and migrations 002 and 003.

## API
- `GET backend/api/students.php`: authenticated, scoped by role (super admin: all; zone admin: assigned zone; branch admin: assigned branch). Department users are denied.
- `POST backend/api/student_save.php`: super admin only, requires same-origin JSON request, session and `X-CSRF-Token`. Create with `student_code`, `full_name`, `branch_id` (integer), `grade_level`, `status`. Update with `id`, `version` and same non-code fields. No delete endpoint.

Examples (demonstration values only):
```json
{"student_code":"TEST-001","full_name":"Example Student","branch_id":1,"grade_level":"10","status":"active"}
```
These records are for synthetic testing only; do not enter real student information.

## Important
Student UI integration and full PHP/MySQL security tests are not yet complete. This module is NOT approved for real student data. Confirm official grade categories, permissions, retention, consent, security, and XAMPP behavior before production. No public self-registration endpoint or sample accounts are included.
