# Workflow & State Documentation

This document defines state machines for core modules and maps them to the `workflow_transitions` concept described in `security_erp_system_blueprint_next.md`. The intent is to make each workflow explicit and enforceable by the workflow engine (e.g., `transition_entity_status`) using `entity_type`, `from_status`, `to_status`, `required_roles`, and `required_fields` entries in `workflow_transitions`.

## General Conventions

- **Entity status changes** must be performed through the workflow engine (e.g., `transition_entity_status`) so validations, role checks, and audit logs are consistent with `workflow_transitions`.
- **Required fields per transition** describe fields that must be present in the payload or entity record before the transition is accepted.
- **Responsible roles** are the minimum roles allowed to execute the transition. Local orgs may override with additional roles.
- **Failure/rollback** describes what happens when a transition fails validation or a downstream action fails (e.g., a deployment capacity constraint).

---

## Guard Lifecycle

### States
- `applicant`
- `screening`
- `approved`
- `onboarding`
- `active`
- `suspended`
- `terminated`
- `archived`

### Allowed Transitions
| From | To | Required fields | Responsible roles | Failure/Rollback behavior |
| --- | --- | --- | --- | --- |
| applicant | screening | `screening_started_at`, `screening_owner_id` | HR, Compliance | Reject if required fields missing; no state change. |
| screening | approved | `screening_completed_at`, `screening_result` | HR, Compliance | Reject if open compliance issues exist. |
| screening | terminated | `termination_reason`, `terminated_at` | HR, Compliance | Reject if `termination_reason` missing. |
| approved | onboarding | `onboarding_start_at`, `onboarding_owner_id` | HR | Reject if background checks are incomplete. |
| onboarding | active | `employment_start_date`, `assigned_branch_id` | HR, Operations | Reject if no branch assignment; no status change. |
| active | suspended | `suspension_reason`, `suspended_at` | HR, Operations | Reject if open payroll run is locked; requires override. |
| suspended | active | `reinstated_at`, `reinstated_by` | HR | Reject if compliance block persists. |
| active | terminated | `termination_reason`, `terminated_at` | HR | Reject if guard has active deployment unless forced revoke. |
| terminated | archived | `archived_at`, `archived_by` | HR, Compliance | Reject if retention period not met. |

### Failure/Rollback Notes
- Guard transitions are rejected if required fields or role checks fail; the system should return a validation error and keep the original state.
- If the transition depends on external actions (e.g., terminating a guard must revoke deployments), the transaction should be atomic. If revoke fails, the guard remains `active` and a failure audit is logged.

---

## Deployments

### States
- `planned`
- `active`
- `suspended`
- `ended`
- `revoked`

### Allowed Transitions
| From | To | Required fields | Responsible roles | Failure/Rollback behavior |
| --- | --- | --- | --- | --- |
| planned | active | `deployed_at`, `branch_id`, `shift_type`, `guard_id` | Operations, Scheduler | Reject if guard not `active` or capacity exceeded. |
| active | suspended | `suspension_reason`, `suspended_at` | Operations | Reject if no reason provided. |
| suspended | active | `resumed_at`, `resumed_by` | Operations | Reject if capacity constraints changed. |
| active | ended | `ended_at`, `end_reason` | Operations | Reject if attendance not finalized for end date (soft block). |
| planned | revoked | `revoked_at`, `revoked_reason` | Operations, HR | Reject if guard already checked in. |
| active | revoked | `revoked_at`, `revoked_reason` | Operations, HR | If revoke fails (e.g., payroll lock), rollback to `active`. |

### Failure/Rollback Notes
- Use `deploy_guard` and `revoke_deployment` to enforce eligibility and capacity checks. If these fail, the workflow transition must be rejected.
- Attendance and payroll links should be validated on end/revoke; failures keep status as-is with an audit log entry.

---

## Attendance

### States
- `draft`
- `submitted`
- `reviewed`
- `approved`
- `locked`

### Allowed Transitions
| From | To | Required fields | Responsible roles | Failure/Rollback behavior |
| --- | --- | --- | --- | --- |
| draft | submitted | `attendance_date`, `branch_id`, `submitted_by` | Supervisor | Reject if missing rows or validation exceptions not addressed. |
| submitted | reviewed | `reviewed_by`, `reviewed_at` | Operations, HR | Reject if exceptions unresolved without override. |
| reviewed | approved | `approved_by`, `approved_at` | Operations Manager, HR | Reject if overtime approvals missing. |
| approved | locked | `locked_by`, `locked_at` | Payroll, Finance | Reject if payroll run already finalized (idempotent). |
| submitted | draft | `reverted_by`, `reverted_at`, `revert_reason` | Supervisor | Reject if already reviewed. |

### Failure/Rollback Notes
- The `upsert_attendance_bulk` process should not change state; it only writes data and exceptions.
- Locking prevents edits; unlock requires admin override and creates audit entries.

---

## Payroll

### States
- `draft`
- `calculated`
- `reviewed`
- `approved`
- `finalized`
- `exported`

### Allowed Transitions
| From | To | Required fields | Responsible roles | Failure/Rollback behavior |
| --- | --- | --- | --- | --- |
| draft | calculated | `payroll_run_id`, `month`, `year` | Payroll | Reject if attendance not locked. |
| calculated | reviewed | `reviewed_by`, `reviewed_at` | Payroll, Finance | Reject if validation errors in run. |
| reviewed | approved | `approved_by`, `approved_at` | Finance Manager | Reject if variance thresholds exceeded without approval note. |
| approved | finalized | `finalized_by`, `finalized_at` | Payroll Manager | If finalize fails, keep `approved` and log error. |
| finalized | exported | `exported_by`, `exported_at`, `export_file` | Payroll | Reject if export generation failed. |
| reviewed | draft | `reverted_by`, `revert_reason` | Payroll Manager | Reject if already finalized. |

### Failure/Rollback Notes
- `generate_payroll_run` and `finalize_payroll_run` should be transactional. Any calculation error keeps the run in its prior state.
- If exports fail, maintain `finalized` state and allow re-export attempts.

---

## Billing (Invoicing)

### States
- `draft`
- `issued`
- `sent`
- `partially_paid`
- `paid`
- `overdue`
- `void`

### Allowed Transitions
| From | To | Required fields | Responsible roles | Failure/Rollback behavior |
| --- | --- | --- | --- | --- |
| draft | issued | `issue_date`, `due_date`, `billing_contact_id` | Finance | Reject if attendance summaries missing. |
| issued | sent | `sent_at`, `sent_by` | Finance, Billing | Reject if delivery channel not configured. |
| sent | partially_paid | `payment_amount`, `payment_date`, `payment_method` | Finance, AR | Reject if payment < 0 or exceeds balance. |
| sent | paid | `payment_amount`, `payment_date`, `payment_method` | Finance, AR | Reject if payment != outstanding. |
| partially_paid | paid | `payment_amount`, `payment_date`, `payment_method` | Finance, AR | Reject if balance not cleared. |
| sent | overdue | `overdue_at` | System (scheduled job) | Only if due date passed and balance > 0. |
| issued | void | `voided_at`, `void_reason` | Finance Manager | Reject if any payment exists. |
| sent | void | `voided_at`, `void_reason` | Finance Manager | Reject if any payment exists. |

### Failure/Rollback Notes
- `generate_invoices` and `compute_invoice` should remain in `draft` if calculations fail.
- Payment recording should be atomic; if receipt creation fails, payment is not applied and status remains unchanged.

---

## Inventory

### States
- `available`
- `reserved`
- `issued`
- `in_service`
- `maintenance`
- `returned`
- `retired`
- `lost`

### Allowed Transitions
| From | To | Required fields | Responsible roles | Failure/Rollback behavior |
| --- | --- | --- | --- | --- |
| available | reserved | `reserved_by`, `reserved_at`, `assignment_target` | Logistics, Operations | Reject if asset not in `available` condition. |
| reserved | issued | `assigned_by`, `assigned_at`, `guard_id` or `branch_id` | Logistics | Reject if guard inactive or assignment target invalid. |
| issued | in_service | `service_started_at` | Operations | Reject if issue record missing. |
| in_service | maintenance | `maintenance_reason`, `maintenance_start_at` | Logistics, Maintenance | Reject if asset already flagged lost. |
| maintenance | available | `maintenance_end_at`, `condition` | Maintenance | Reject if condition is unacceptable for reuse. |
| in_service | returned | `returned_at`, `returned_by`, `condition_on_return` | Logistics | Reject if return condition missing. |
| returned | available | `inspection_at`, `inspected_by`, `condition` | Logistics | Reject if inspection not completed. |
| issued | lost | `lost_reported_at`, `loss_reason` | Operations, Compliance | Reject if loss report incomplete. |
| in_service | retired | `retired_at`, `retire_reason` | Logistics Manager | Reject if asset still assigned without handover. |

### Failure/Rollback Notes
- Inventory assignment changes should be atomic with `inventory_assignments` writes; failures keep the previous state.
- If a return is rejected due to inspection, the asset remains `returned` until inspection is completed.

---

## Tickets & Support

### States
- `new`
- `triaged`
- `in_progress`
- `pending_customer`
- `resolved`
- `closed`
- `reopened`

### Allowed Transitions
| From | To | Required fields | Responsible roles | Failure/Rollback behavior |
| --- | --- | --- | --- | --- |
| new | triaged | `triaged_by`, `triaged_at`, `priority_id` | Support, Operations | Reject if category or priority missing. |
| triaged | in_progress | `assigned_to`, `started_at` | Support | Reject if no assignee. |
| in_progress | pending_customer | `pending_reason`, `pending_at` | Support | Reject if reason missing. |
| pending_customer | in_progress | `customer_response_at` | Support | Reject if customer response absent. |
| in_progress | resolved | `resolution_summary`, `resolved_at` | Support | Reject if resolution not provided. |
| resolved | closed | `closed_by`, `closed_at` | Support Lead | Reject if post-resolution survey required and missing. |
| resolved | reopened | `reopen_reason`, `reopened_at` | Support, Requester | Reject if reopen reason missing. |
| closed | reopened | `reopen_reason`, `reopened_at` | Support Lead | Reject if outside reopen window unless override. |

### Failure/Rollback Notes
- Ticket transitions must append ticket comments or internal notes when required fields are missing; failures keep the ticket in its prior state.
- Reopen actions should also reset SLA timers where applicable.

---

## How to Map to `workflow_transitions`

For each transition above, define a row in `workflow_transitions`:
- `entity_type`: module entity name (e.g., `guard`, `deployment`, `attendance`, `payroll_run`, `invoice`, `inventory_product`, `ticket`).
- `from_status`, `to_status`: map directly to the state table above.
- `required_roles`: roles listed in the table.
- `required_fields`: required fields listed in the table.
- `validation_rules`: optional JSON rules for more complex constraints (capacity, SLA, scope).

This makes the workflow engine the single gatekeeper for state changes and keeps validations consistent across UI and API paths.
