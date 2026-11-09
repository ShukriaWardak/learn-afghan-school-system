# LEARN Afghan implementation status — 4 November 2026

Current development branch: `feature/branch-approvals-2026-11-04`, based on the reporting branch from draft PR 9. It includes the branded login, registry, student attendance, personnel attendance and aggregate-reporting code from the stacked PRs, with the Windows setup helper brought forward from PR 5. Existing PRs remain separate for review; this does not merge them into `main`.

## Implemented development capabilities

| Area | Available code | Remaining practical limit |
| --- | --- | --- |
| Authentication | Branded sign-in, sessions, CSRF, login throttling, logout, CLI first-account enrollment and recovery | Local installation/security/organization acceptance is still required; no public signup |
| Organization | Zones and branches, department directory/create/rename | Approved organization records and field definitions still needed |
| People | Student, teacher and staff registries with scoped reads, super-admin writes, search, status and conflict protection | HR contact/employment documents, leave and payroll are not implemented |
| Attendance | Daily student, teacher and staff attendance with audited corrections | No payroll calculations or automatic treatment of missing attendance |
| Reports | Role-scoped counts/status/attendance, branch aggregate CSV | PDF/XLSX exports, scheduled reports and approved reporting formats remain |
| Branch approvals | Pending queue, approve/reject, notes, recent decisions, concurrency checks and audit rollback | Departmental/finance submissions and any two-person rules still need design |
| Audit | Existing server-generated write history; approval notes stored in transactional audit details | Advanced audit search, retention and tamper-resistance operations remain |
| Setup | Read-only checker and guided Windows setup/recovery script | Scripts do not import migrations automatically; native XAMPP acceptance remains |

Implemented means code is present. Consult the GitHub Actions result for the exact commit before treating its automated checks as passed; it does not confirm the team's Windows/Mac installations or production readiness.

## Next implementation sequence

1. **Finance:** reviewed fields/permissions, income and expense ledger, exact decimal amounts/currencies, statuses, audited edits, summaries and safe exports.
2. **Payroll and HR:** approved salary/allowance/deduction rules, periods and payroll review. Attendance alone must not determine salary or deductions without agreed policy.
3. **Departmental forms and approvals:** education/curriculum, health/midwifery, logistics/security, proposals, surveys, IT, media, and safeguarding/PSEA. Official fields, access and approval rules are required, especially for sensitive records.
4. **Account management:** invitations/provisioning, reviewed role assignments, password recovery/MFA and session policy.
5. **Backup and recovery:** backup permissions/storage, encryption/retention, protected export and a tested restore process.
6. **Completion work:** settings/languages/RTL, PDF/XLSX reports, security review and one coordinated XAMPP/pilot acceptance pass before deployment.

## Effective team workflow

Use one agreed working branch and small reviewed feature branches for the three teammates. Keep `backend/config.local.php` and actual database records out of Git. Commit schema migrations with each feature, test synthetic fixtures automatically, then collect local installation evidence in one coordinated pass. GitHub shares source and migrations, not the contents of each teammate's MySQL database.

The database currently needs `schema.sql` followed by migrations 002–006 (10 tables). Branch approvals add no database tables. Existing databases should be inspected before applying any missing migration; no real-data migration, account reset, deployment or PR merge is performed by these code changes.
