# API Contracts — Supabase RPC Functions

> Source: `security_erp_system_blueprint_next.md` RPC list. This document consolidates inputs, outputs, validation rules, error codes, side effects, and example payloads for each RPC. All RPCs are expected to run **transactionally** and return structured error codes on failure.

## Conventions

### Common request envelope (suggested)
```json
{
  "params": {
    "...": "function-specific fields"
  },
  "meta": {
    "request_id": "uuid",
    "actor_user_id": "uuid"
  }
}
```

### Common error shape (suggested)
```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "User lacks permission for payroll:generate",
    "details": {
      "module": "payroll",
      "action": "generate"
    }
  }
}
```

### Common validation rules (apply to all RPCs unless noted)
- **Org scope**: `org_id` derived from `auth.uid()` must match any referenced entity’s `org_id`.
- **Permission check**: `check_permission(user_id, module, action)` must pass for the module/action.
- **Entity existence**: referenced entity IDs must exist and be active where applicable.
- **Date sanity**: `month/year` pairs must be valid calendar values; `start_date <= end_date`.
- **Idempotency**: operations that create a run/invoice should prevent duplicate runs for same period + scope.

### Standard error codes
- `PERMISSION_DENIED`
- `OUT_OF_SCOPE`
- `NOT_FOUND`
- `INVALID_ARGUMENT`
- `CONFLICT`
- `CAPACITY_EXCEEDED`
- `VALIDATION_FAILED`
- `ALREADY_FINALIZED`
- `INSUFFICIENT_STATE`
- `INTERNAL_ERROR`

---

## 1) IAM / Permissions

### 1.1 `check_permission(user_id, module, action) → boolean`
**Purpose**: Validate if a user can perform an action in a module.

**Inputs**
- `user_id` (uuid, required)
- `module` (text, required; e.g. `"payroll"`, `"billing"`)
- `action` (text, required; e.g. `"generate"`, `"update"`)

**Outputs**
- `boolean` — `true` if allowed, else `false`.

**Validation rules**
- `user_id` must exist in `profiles`.
- `module/action` must exist in `permissions`.

**Errors**
- `NOT_FOUND`: invalid `user_id` or unknown `module/action`.

**Side effects**
- None (pure function).

**Example**
```json
{
  "params": {
    "user_id": "f04b7b3a-61b6-4d02-a4f8-3a7bcb3c7a5e",
    "module": "payroll",
    "action": "generate"
  }
}
```

---

### 1.2 `get_user_scopes(user_id) → {regions[], branches[], clients[]}`
**Purpose**: Return the regional/branch/client scope lists for a user.

**Inputs**
- `user_id` (uuid, required)

**Outputs**
```json
{
  "regions": ["uuid"],
  "branches": ["uuid"],
  "clients": ["uuid"]
}
```

**Validation rules**
- `user_id` must exist.

**Errors**
- `NOT_FOUND`: invalid `user_id`.

**Side effects**
- None.

**Example**
```json
{
  "params": {
    "user_id": "f04b7b3a-61b6-4d02-a4f8-3a7bcb3c7a5e"
  }
}
```

---

### 1.3 `assert_scope(entity_table, entity_id, user_id) → void`
**Purpose**: Raise an error if the user is out of scope for an entity.

**Inputs**
- `entity_table` (text, required)
- `entity_id` (uuid, required)
- `user_id` (uuid, required)

**Outputs**
- None (void). Success means scope is allowed.

**Validation rules**
- `entity_table` must be in allowlist of scope-aware tables.
- `entity_id` must exist in that table.

**Errors**
- `OUT_OF_SCOPE`: user does not have scope for entity.
- `NOT_FOUND`: `entity_id` not found.
- `INVALID_ARGUMENT`: unknown `entity_table`.

**Side effects**
- None.

**Example**
```json
{
  "params": {
    "entity_table": "guards",
    "entity_id": "c391f39f-0a3a-4a47-a480-520fdd4eb8c9",
    "user_id": "f04b7b3a-61b6-4d02-a4f8-3a7bcb3c7a5e"
  }
}
```

---

## 2) Workflow Engine

### 2.1 `transition_entity_status(entity_type, entity_id, to_status, payload JSONB) → void`
**Purpose**: Transition an entity status using configured workflow rules.

**Inputs**
- `entity_type` (text, required; e.g. `"guard"`, `"invoice"`, `"ticket"`)
- `entity_id` (uuid, required)
- `to_status` (text, required)
- `payload` (jsonb, optional; supplemental data)

**Outputs**
- None (void). Updates happen on success.

**Validation rules**
- Validate allowed transition in `workflow_transitions`.
- Validate required fields are present in `payload` or entity.
- Validate custom rules in `validation_rules`.

**Errors**
- `INSUFFICIENT_STATE`: invalid transition or missing required fields.
- `VALIDATION_FAILED`: custom rule violation.
- `NOT_FOUND`: entity or transition missing.

**Side effects**
- Updates entity status.
- Inserts into status history table (e.g., `guard_status_history`).
- Inserts into `audit_logs`.

**Example**
```json
{
  "params": {
    "entity_type": "guard",
    "entity_id": "c391f39f-0a3a-4a47-a480-520fdd4eb8c9",
    "to_status": "verified",
    "payload": {
      "verified_by": "f04b7b3a-61b6-4d02-a4f8-3a7bcb3c7a5e",
      "remarks": "CNIC verified"
    }
  }
}
```

---

## 3) Deployments & Capacity

### 3.1 `deploy_guard(guard_id, branch_id, shift_type, deployed_at, contract_id?) → deployment_id`
**Purpose**: Assign a guard to a branch/shift.

**Inputs**
- `guard_id` (uuid, required)
- `branch_id` (uuid, required)
- `shift_type` (text, required; e.g. `"day"`, `"night"`)
- `deployed_at` (timestamptz, required)
- `contract_id` (uuid, optional)

**Outputs**
- `deployment_id` (uuid)

**Validation rules**
- Guard must be in eligible status (`guard_statuses`).
- Guard must not have another active deployment (unless multi-site allowed).
- Branch capacity for the shift must not be exceeded.
- `contract_id` must belong to branch’s client if supplied.

**Errors**
- `CONFLICT`: guard already deployed.
- `CAPACITY_EXCEEDED`: branch capacity exceeded.
- `INVALID_ARGUMENT`: invalid `shift_type`.
- `NOT_FOUND`: guard/branch/contract not found.

**Side effects**
- Insert into `guard_deployments` (active).
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "guard_id": "7b1d6a86-1d9f-4e9f-bb92-5a3e2f4a39a4",
    "branch_id": "b4f4a7d6-f39b-47f6-9c54-36df2eab3fd8",
    "shift_type": "day",
    "deployed_at": "2024-10-01T08:00:00Z",
    "contract_id": "0ff20952-1e1f-40c1-89b4-5a1d81ccf4da"
  }
}
```

---

### 3.2 `revoke_deployment(deployment_id, revoked_at, reason?) → void`
**Purpose**: Revoke an active deployment.

**Inputs**
- `deployment_id` (uuid, required)
- `revoked_at` (timestamptz, required)
- `reason` (text, optional)

**Outputs**
- None.

**Validation rules**
- Deployment must exist and be active.
- `revoked_at` must be after `deployed_at`.

**Errors**
- `NOT_FOUND`: deployment not found.
- `CONFLICT`: already revoked.
- `INVALID_ARGUMENT`: invalid timestamps.

**Side effects**
- Update `guard_deployments` (set `revoked_at`, `is_active=false`).
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "deployment_id": "7a0b1e56-29c7-4ef0-8863-8b16b64b4f43",
    "revoked_at": "2024-10-10T18:00:00Z",
    "reason": "Contract ended"
  }
}
```

---

## 4) Attendance

### 4.1 `upsert_attendance_bulk(branch_id, attendance_date, rows JSONB) → {inserted, updated, exceptions}`
**Purpose**: Bulk insert or update attendance for a branch/day.

**Inputs**
- `branch_id` (uuid, required)
- `attendance_date` (date, required)
- `rows` (jsonb array, required)
  - Each row: `{guard_id, status, shift, source}`

**Outputs**
```json
{
  "inserted": 120,
  "updated": 5,
  "exceptions": 2
}
```

**Validation rules**
- Each `guard_id` must belong to the branch via active deployment on that date.
- `status` must be one of `P`, `A`, `L`, `H`.
- `shift` must be valid for branch roster.

**Errors**
- `INVALID_ARGUMENT`: malformed rows.
- `VALIDATION_FAILED`: invalid statuses/shift.

**Side effects**
- Insert/update `guard_attendance`.
- Insert into `attendance_exceptions` for missing deployment.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "branch_id": "b4f4a7d6-f39b-47f6-9c54-36df2eab3fd8",
    "attendance_date": "2024-10-05",
    "rows": [
      {"guard_id": "7b1d6a86-1d9f-4e9f-bb92-5a3e2f4a39a4", "status": "P", "shift": "day", "source": "web"},
      {"guard_id": "8913dd2c-24bd-4f6d-b9c1-8d2a1a8b08c2", "status": "A", "shift": "night", "source": "mobile"}
    ]
  }
}
```

---

### 4.2 `compute_attendance_summary(month, year, branch_id?, client_id?) → summary`
**Purpose**: Compute monthly attendance summaries for dashboards, payroll, invoices.

**Inputs**
- `month` (int 1-12, required)
- `year` (int, required)
- `branch_id` (uuid, optional)
- `client_id` (uuid, optional)

**Outputs**
- Summary object (implementation-defined), e.g.
```json
{
  "total_present": 1234,
  "total_absent": 87,
  "by_branch": [
    {"branch_id": "...", "present": 300, "absent": 10}
  ]
}
```

**Validation rules**
- `branch_id` and `client_id` cannot both be set if mutually exclusive.

**Errors**
- `INVALID_ARGUMENT`: invalid month/year.
- `NOT_FOUND`: branch/client not found.

**Side effects**
- None (read model computation).

**Example**
```json
{
  "params": {
    "month": 10,
    "year": 2024,
    "branch_id": "b4f4a7d6-f39b-47f6-9c54-36df2eab3fd8"
  }
}
```

---

## 5) Payroll

### 5.1 `generate_payroll_run(month, year, regional_office_id?) → payroll_run_id`
**Purpose**: Create a payroll run and compute items.

**Inputs**
- `month` (int 1-12, required)
- `year` (int, required)
- `regional_office_id` (uuid, optional)

**Outputs**
- `payroll_run_id` (uuid)

**Validation rules**
- Prevent duplicate run for same `month/year/regional_office_id`.
- Ensure required attendance data is available.

**Errors**
- `CONFLICT`: payroll run already exists.
- `INVALID_ARGUMENT`: invalid month/year.
- `INSUFFICIENT_STATE`: missing attendance or policy data.

**Side effects**
- Insert into `payroll_runs` (status `draft`).
- Insert computed `payroll_items`.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "month": 10,
    "year": 2024,
    "regional_office_id": "e0b41fcb-1bc3-49ea-99f4-0e40511b8e62"
  }
}
```

---

### 5.2 `compute_payroll_item(guard_id, month, year, policy JSONB) → breakdown`
**Purpose**: Compute a single guard’s payroll breakdown.

**Inputs**
- `guard_id` (uuid, required)
- `month` (int 1-12, required)
- `year` (int, required)
- `policy` (jsonb, required; allowance/deduction rules)

**Outputs**
```json
{
  "basic_salary": 35000,
  "allowances": {"housing": 5000},
  "deductions": {"tax": 2000},
  "gross_salary": 40000,
  "net_salary": 38000
}
```

**Validation rules**
- `policy` must include required keys (e.g., `basic_salary`, `allowances`, `deductions`).

**Errors**
- `NOT_FOUND`: guard not found.
- `VALIDATION_FAILED`: invalid policy structure.

**Side effects**
- None (pure computation).

**Example**
```json
{
  "params": {
    "guard_id": "7b1d6a86-1d9f-4e9f-bb92-5a3e2f4a39a4",
    "month": 10,
    "year": 2024,
    "policy": {
      "basic_salary": 35000,
      "allowances": {"housing": 5000},
      "deductions": {"tax": 2000}
    }
  }
}
```

---

### 5.3 `apply_loan_deductions(payroll_run_id) → void`
**Purpose**: Apply outstanding loan deductions to payroll items.

**Inputs**
- `payroll_run_id` (uuid, required)

**Outputs**
- None.

**Validation rules**
- Payroll run must be in `draft` or `review` state.

**Errors**
- `NOT_FOUND`: payroll run not found.
- `ALREADY_FINALIZED`: cannot modify a finalized run.

**Side effects**
- Insert into `loan_deductions`.
- Update `payroll_items.deductions` and `net_salary`.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "payroll_run_id": "9b67c21e-3a8a-45f5-b013-7d8b3b8e2cb1"
  }
}
```

---

### 5.4 `finalize_payroll_run(payroll_run_id) → void`
**Purpose**: Lock payroll run and create payslip export entries.

**Inputs**
- `payroll_run_id` (uuid, required)

**Outputs**
- None.

**Validation rules**
- Run must be in `review` (or `draft` if allowed).
- Run must not be finalized already.

**Errors**
- `ALREADY_FINALIZED`: run already finalized.
- `INSUFFICIENT_STATE`: invalid run status.

**Side effects**
- Update `payroll_runs.status` to `final` and set `finalized_at`.
- Insert into `payslip_exports`.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "payroll_run_id": "9b67c21e-3a8a-45f5-b013-7d8b3b8e2cb1"
  }
}
```

---

## 6) Invoicing

### 6.1 `generate_invoices(month, year, client_id?) → invoice_ids[]`
**Purpose**: Generate invoices for a billing period.

**Inputs**
- `month` (int 1-12, required)
- `year` (int, required)
- `client_id` (uuid, optional)

**Outputs**
```json
{
  "invoice_ids": ["uuid", "uuid"]
}
```

**Validation rules**
- Prevent duplicate invoices for same period/client.
- Must have attendance summary + active contract rates.

**Errors**
- `CONFLICT`: invoices already exist.
- `INSUFFICIENT_STATE`: missing rates or attendance.

**Side effects**
- Insert into `invoices` (status `draft`).
- Insert `invoice_line_items`.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "month": 10,
    "year": 2024,
    "client_id": "0b9b1b38-13c0-4f0f-862a-4c9d3f5fb17f"
  }
}
```

---

### 6.2 `compute_invoice(invoice_id) → totals`
**Purpose**: Recompute totals for an invoice.

**Inputs**
- `invoice_id` (uuid, required)

**Outputs**
```json
{
  "subtotal": 450000,
  "tax_amount": 81000,
  "total_amount": 531000
}
```

**Validation rules**
- Invoice must be in `draft` state.

**Errors**
- `NOT_FOUND`: invoice not found.
- `ALREADY_FINALIZED`: invoice already sent/paid.

**Side effects**
- Update `invoices.subtotal/tax_amount/total_amount`.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "invoice_id": "d8cc09b3-7b61-41c2-81f1-1af9cc7e541f"
  }
}
```

---

### 6.3 `record_invoice_payment(invoice_id, amount, payment_date, method, reference_no) → payment_id`
**Purpose**: Record a payment against an invoice.

**Inputs**
- `invoice_id` (uuid, required)
- `amount` (numeric, required)
- `payment_date` (date, required)
- `method` (text, required; e.g. `"bank_transfer"`)
- `reference_no` (text, optional)

**Outputs**
- `payment_id` (uuid)

**Validation rules**
- `amount` > 0 and <= outstanding balance.
- Invoice must not be voided.

**Errors**
- `INVALID_ARGUMENT`: invalid amount or date.
- `CONFLICT`: payment exceeds balance.

**Side effects**
- Insert into `invoice_payments`.
- Update invoice status if fully paid.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "invoice_id": "d8cc09b3-7b61-41c2-81f1-1af9cc7e541f",
    "amount": 531000,
    "payment_date": "2024-11-05",
    "method": "bank_transfer",
    "reference_no": "TRX-991223"
  }
}
```

---

### 6.4 `update_invoice_statuses(today_date) → {updated}`
**Purpose**: Mark invoices as overdue based on due date.

**Inputs**
- `today_date` (date, required)

**Outputs**
```json
{
  "updated": 12
}
```

**Validation rules**
- `today_date` must be a valid date.

**Errors**
- `INVALID_ARGUMENT`: invalid date.

**Side effects**
- Update `invoices.status` to `overdue` where applicable.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "today_date": "2024-11-01"
  }
}
```

---

## 7) Inventory

### 7.1 `issue_inventory(product_id, guard_id?, branch_id?, assigned_by) → assignment_id`
**Purpose**: Assign inventory item to a guard or branch.

**Inputs**
- `product_id` (uuid, required)
- `guard_id` (uuid, optional)
- `branch_id` (uuid, optional)
- `assigned_by` (uuid, required)

**Outputs**
- `assignment_id` (uuid)

**Validation rules**
- Exactly one of `guard_id` or `branch_id` must be provided.
- Product must be available and in valid status.

**Errors**
- `INVALID_ARGUMENT`: both/neither target IDs provided.
- `CONFLICT`: product already assigned.

**Side effects**
- Insert into `inventory_assignments`.
- Update `inventory_products.status`.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "product_id": "b2e22548-fb99-4a19-9cdf-8d0a5ea7012e",
    "guard_id": "7b1d6a86-1d9f-4e9f-bb92-5a3e2f4a39a4",
    "assigned_by": "f04b7b3a-61b6-4d02-a4f8-3a7bcb3c7a5e"
  }
}
```

---

### 7.2 `return_inventory(assignment_id, condition_on_return, returned_by) → void`
**Purpose**: Return an assigned inventory item.

**Inputs**
- `assignment_id` (uuid, required)
- `condition_on_return` (text, required; e.g. `"good"`, `"damaged"`)
- `returned_by` (uuid, required)

**Outputs**
- None.

**Validation rules**
- Assignment must be active (not returned).

**Errors**
- `NOT_FOUND`: assignment not found.
- `CONFLICT`: already returned.

**Side effects**
- Update `inventory_assignments.returned_at` and condition.
- Update `inventory_products.status`.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "assignment_id": "88fef0b0-2a29-4e0d-8fe2-3fb0dfb0f2fb",
    "condition_on_return": "good",
    "returned_by": "f04b7b3a-61b6-4d02-a4f8-3a7bcb3c7a5e"
  }
}
```

---

### 7.3 `check_license_expiry(days_ahead) → expiring_items[]`
**Purpose**: List inventory items with licenses expiring soon.

**Inputs**
- `days_ahead` (int, required; > 0)

**Outputs**
```json
{
  "items": [
    {"product_id": "...", "license_expiry": "2024-11-10"}
  ]
}
```

**Validation rules**
- `days_ahead` must be positive.

**Errors**
- `INVALID_ARGUMENT`: invalid `days_ahead`.

**Side effects**
- None (read-only).

**Example**
```json
{
  "params": {
    "days_ahead": 30
  }
}
```

---

## 8) Scheduled Reports

### 8.1 `run_scheduled_reports(now_ts) → {jobs_run, exports_created}`
**Purpose**: Execute scheduled report jobs.

**Inputs**
- `now_ts` (timestamptz, required)

**Outputs**
```json
{
  "jobs_run": 3,
  "exports_created": 3
}
```

**Validation rules**
- `now_ts` must be valid timestamp.

**Errors**
- `INVALID_ARGUMENT`: invalid timestamp.

**Side effects**
- Insert into `export_jobs`.
- Potentially send emails to recipients.
- Write to `audit_logs`.

**Example**
```json
{
  "params": {
    "now_ts": "2024-11-01T01:00:00Z"
  }
}
```

