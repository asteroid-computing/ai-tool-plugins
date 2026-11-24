---
tags: [skill-creator, dynamodb]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

We're moving our payroll SaaS to DynamoDB (Go on Lambda). Companies are our tenants; a user's session token carries their company ID. The biggest company has 12,000 employees; most have under 200.

Data and screens:

- employee page: the employee's details and their last 6 payslips, newest first
- the employee page also shows the last 10 audit events about that employee
- company admin: list employees by surname, 50 a page
- a pay run: an admin starts it for a company, and it creates one payslip for every employee of the company, all for the same pay date. The 12,000-employee company runs payroll twice a month
- payslip PDF download by payslip ID from the employee page (the URL is /employees/{employeeId}/payslips/{payslipId})

What we know about operations:

- audit events: every change to an employee or a payslip writes one. Compliance needs them for 7 years, needs to restore them on their own without rolling back anything else, and our SIEM reads them as a stream
- API idempotency keys: one item per mutating request, kept 24 hours; they need no backup
- for employees, payslips and pay runs, nobody has told us the backup or retention needs yet

Can you design the table(s)? Write the design to design.md.
