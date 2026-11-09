# LEARN Afghan implementation status — Finance development increment, 9 November 2026

Development branch: `feature/finance-dashboard-20261109`, based on the navigation fixes in PR 15. It carries the authenticated branch-approval stack, branded login, latest reference dashboard and graduation photo forward, then adds a sample Finance ledger. This is a review branch stacked on PR 15; these Finance changes are not merged into the shared working branch or `main`.

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
| Finance | Sample AFN income/expense ledger, Finance-only scoped add/edit, super-admin read-only access, decimal totals, filtered pagination, retry protection and transactional audit | Final fields/team provisioning, payroll, budgets, bank reconciliation, approvals and exports remain; see database/FINANCE_SETUP.md |
| Setup | Read-only checker and guided Windows setup/recovery script | Scripts do not import migrations automatically; native XAMPP acceptance remains |

Implemented means code is present. See [FINANCE_VERIFICATION.md](FINANCE_VERIFICATION.md) and the GitHub Actions result for the exact commit for verification evidence. Automated checks do not confirm the team's Windows/Mac installations or production readiness. The dashboard retains institution-provided reference totals of 4,545 students, 81 teachers and 25 branches; they are not live database counts.

## Next implementation sequence

1. **Finance:** review the implemented sample fields and scopes with the five-person team, provision approved accounts, and define subsequent reconciliation, reporting and approval requirements.
2. **Payroll and HR:** approved salary/allowance/deduction rules, periods and payroll review. Attendance alone must not determine salary or deductions without agreed policy.
3. **Departmental forms and approvals:** education/curriculum, health/midwifery, logistics/security, proposals, surveys, IT, media, and safeguarding/PSEA. Official fields, access and approval rules are required, especially for sensitive records.
4. **Account management:** invitations/provisioning, reviewed role assignments, password recovery/MFA and session policy.
5. **Backup and recovery:** backup permissions/storage, encryption/retention, protected export and a tested restore process.
6. **Completion work:** settings/languages/RTL, PDF/XLSX reports, security review and one coordinated XAMPP/pilot acceptance pass before deployment.

## Effective team workflow

Use one agreed working branch and small reviewed feature branches for the three teammates. Keep `backend/config.local.php` and actual database records out of Git. Commit schema migrations with each feature, test synthetic fixtures automatically, then collect local installation evidence in one coordinated pass. GitHub shares source and migrations, not the contents of each teammate's MySQL database.

The Finance increment needs `schema.sql` followed by migrations 002–007 (11 tables). Branch approvals add no database tables. Existing databases should be inspected before applying any missing migration; no real-data migration, account reset, deployment or PR merge is performed by these code changes.
