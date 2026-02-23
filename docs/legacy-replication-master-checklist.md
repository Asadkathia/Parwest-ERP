# Legacy ERP Complete Replication Master Checklist

Purpose: Track exact legacy parity across modules, screens, forms, workflows, validations, exports/imports, and backend behavior.

Rules:
- Do not mark a screen complete until all columns are complete.
- Legacy ERP is the source of truth for route, labels, fields, dropdowns, table columns, actions, and flow sequence.
- AI features are additive and must not alter legacy-equivalent flows.
- V2-only policy is enforced in current ERP implementation: no new V1 screens/routes/components should be introduced.

Last Updated: 2026-02-22

## Status Legend
- `⬜` Not started
- `🟨` In progress
- `🟩` Complete
- `🚫` Blocked

## Module Completion Snapshot
| Module | Screen Count (Legacy) | Completed | In Progress | Blocked | % Complete |
|---|---:|---:|---:|---:|---:|
| Dashboard | 2 | 0 | 1 | 0 | 0% |
| Guards | 37 | 1 | 13 | 0 | 2.7% |
| Clients | 9 | 1 | 3 | 0 | 11.1% |
| Payroll | 16 | 0 | 0 | 0 | 0% |
| Inventory | 10 | 0 | 0 | 0 | 0% |
| Users & Access | 11 | 0 | 0 | 0 | 0% |
| Reports | 15 | 0 | 0 | 0 | 0% |
| Imports (Bulk) | 15 | 0 | 0 | 0 | 0% |
| Settings/System | 8 | 0 | 0 | 0 | 0% |
| Ticketing | 1 | 0 | 0 | 0 | 0% |
| Requisitions | 1 | 0 | 0 | 0 | 0% |
| Audit | 1 | 0 | 0 | 0 | 0% |

## Global Completion Gates
| Gate | Status | Notes |
|---|---|---|
| Legacy menu tree parity | 🟨 | Consolidation was applied; may need exact legacy navigation mode as final step. |
| Legacy route parity | 🟨 | See `docs/legacy-vs-current-replication.md`. |
| Form field parity (exact labels/options) | 🟨 | Guard add form progressed; full module pass pending. |
| Workflow parity (all actions/modals) | ⬜ | Requires manual UAT per screen. |
| Validation and error-message parity | ⬜ | Pending screen-by-screen backend-connected validation pass. |
| Backend/API parity | ⬜ | Pending after frontend parity freeze. |

---

## Screen-by-Screen Task Tracker

Columns:
- `Route`: route exists and is reachable from correct menu path
- `UI`: sections/titles/tables/buttons match legacy
- `Fields`: exact form labels/types/dropdowns/checkboxes
- `Flow`: create/edit/search/export workflow parity
- `Validation`: required/format/errors match legacy
- `API/DB`: backend behavior parity with legacy
- `Status`: overall row status

### Guards
| Legacy Screen | Legacy Route | Current Route | Route | UI | Fields | Flow | Validation | API/DB | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Add Guard | `/guard/create` | `/guards/new` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Added controlled pre-requisite checklist (`Select All` + item toggles), legacy alias field `parwest_shortname`, explicit `EX` marker, and client-side format validation for CNIC/phone/age with legacy-style error text. |
| Search Guard | `/guard/search` | `/guards/search` | 🟩 | 🟨 | 🟨 | 🟨 | ⬜ | ⬜ | 🟨 | Legacy-style filter matrix expanded (client/supervisor/verification/bank/date/rows/search/check flags), `Show` control label fixed, and table row actions expanded to `View/Edit/Activate/Deactivate`. |
| Export Guard | `/searchByDataTable` | `/guards/export` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Added legacy export filters and confirmation flows with `Yes/No` for `Cancel`, `Reset`, and `Submit`, plus expanded legacy dropdown option sets (status/ex-service/supervisor/verification). |
| Prerequisites | `/guard/mergedOptions` | `/guards/prerequisites` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Added legacy prerequisite blocks plus action-level parity for `All Prerequisites` (`Edit`, `Activate/Deactivate`) with confirm/modal flows (`Yes/No`, `Submit/Close`). |
| Black Listed Guards | `/guard/blackListedGuards` | `/guards/blacklist` | 🟩 | 🟨 | n/a | 🟨 | ⬜ | ⬜ | 🟨 | Added legacy-style listing controls (`Show`, `Search`, `Select Date`), add-to-blacklist flow, and remove confirmation modal (`Yes/No`) with inline success/error feedback. |
| Inactive Guards | `/guard/softDeletedGuardList` | `/guards/inactive` | 🟩 | 🟨 | n/a | 🟨 | ⬜ | ⬜ | 🟨 | Added legacy table controls (`Show`, `Search`, `Select Date`), activation action, confirmation modal (`Yes/No`), and inline success/error notices. |
| Deploy Guards | `/guard/GuardDeployment` | `/guards/deploy` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Added missing `Both` shift option, inline feedback, and expanded fallback legacy option sets for offices/clients/branches/guards to preserve dropdown parity in mock/sparse-data runs. |
| Deployment Rate | `/guard/GuardDeploymentRate` | `/guards/deployments-rate` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Added legacy table controls, fallback legacy region/client options, and missing `Ex Service` filter field (`other/mujahid/rangers/police/army`) with query/payload wiring. |
| Attendance | `/guard/attendance` | `/guards/attendance` | 🟩 | 🟨 | 🟨 | 🟨 | ⬜ | ⬜ | 🟨 | Added bulk attendance mark (multi-select guards), CSV bulk upload (`guardId,date,status,shift,notes`), and defensive guard null rendering in result table. |
| Client Attendance | `/guard/clientAttendance` | `/guards/client-attendance` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Added legacy control bar (`Show`, `Search`), defensive row rendering for null guard/client/office data, and fallback legacy option lists for regional offices/clients. |
| Residences | `/guard/residences` | `/guards/residences` | 🟩 | 🟨 | n/a | 🟨 | ⬜ | ⬜ | 🟨 | Standardized legacy controls (`Show`, `Search`, `Select Date`), converted actions to shared buttons, and unified inline alerts for create/edit flow feedback. |
| Assign Residence | `/guard/residences/assign` | `/guards/assign-residence` | 🟩 | 🟨 | 🟨 | 🟨 | ⬜ | ⬜ | 🟨 | Unified legacy-style assignment flow feedback with shared alerts/buttons and preserved supervisor/residence/guard mapping behavior. |
| On Job Trainings | `/guard/onjob-trainings` | `/guards/trainings` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Added missing legacy listing controls and converted regional office/client/branch filters to legacy dropdown option sets captured from legacy ERP. |
| On Job Trainings V2 | `/guard/onjob-trainings-v2` | `/guards/trainings` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Shares V2 route; parity improvements include legacy dropdown option sets plus existing table/filter controls. |

### Clients
| Legacy Screen | Legacy Route | Current Route | Route | UI | Fields | Flow | Validation | API/DB | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Client Create | `/client/create` | `/clients/new` | 🟩 | 🟨 | 🟨 | ⬜ | ⬜ | ⬜ | 🟨 | |
| Search Client | `/client/searchResult` | `/clients/search` | 🟩 | 🟨 | 🟨 | 🟨 | ⬜ | ⬜ | 🟨 | Legacy filter controls aligned (`Name`, `Type`, `City`, `Show`, `Search`, `Select Date`) with legacy action labels. |
| Search Client V2 | `/client/v2/search` | `/clients/search-v2` | 🟩 | 🟨 | 🟨 | 🟨 | ⬜ | ⬜ | 🟨 | V2-specific clear/update-status behavior aligned in list actions. |
| Client Profile V2 | `/client/show/*` | `/clients/[id]` | 🟩 | 🟨 | 🟨 | 🟨 | ⬜ | ⬜ | 🟨 | Added missing legacy tabs (`Attachments`, `Client Invoicing`) and contact sub-sections (`Basic`, `Contact Person`, `Branch Manager`, `Operations Manager`, `Supervisor`). |
| Types & Locations | `/client/typeList` | `/clients/types-locations` | 🟩 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| Black Listed Clients | `/client/blackListedClients` | `/clients/blacklist` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Added legacy-style email blacklist flow with `Add/Reset/Submit`, `Show/Search` controls, and `Yes/No` confirmation dialogs for submit/reset/delete actions. |
| Export Client Branches | `/client/exportClientBranches` | `/clients/export-branches` | 🟩 | 🟨 | 🟨 | 🟨 | ⬜ | ⬜ | 🟨 | Added legacy manager list, select manager/client filters, `select_all_checkbox` + `check_box_*` matrix, and submit/export flow feedback. |
| Invoice Prerequisites | `/client/invoicePrerequisites` | `/clients/invoice-prerequisites` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Legacy tab set + filters aligned (`Select Province`, `Select City`, `Select Guard Type`, `Show`, `Search`, `Client Province/Cities`, `Guard Types`, `Effective Rate`, `Enqueue`, `Edit Rate`) plus modal parity (`Yes/No`, `Submit`, `Close`) for reset/submit/edit-rate actions. |
| Invoiced Billings | `/client/invoicedBillings` | `/clients/invoiced-billings` | 🟩 | 🟨 | 🟨 | 🟨 | 🟨 | ⬜ | 🟨 | Added legacy-style filters (`Select Client/Branch/Invoice Month/From/To/Due/Status`, `Show`, `Search`, `Add Payment`) plus Invoiced/Error tabs, row actions (`View`, `Download`, `Update`, `Post`), and modal parity (`Yes/No`, `SUBMIT`, `CLOSE`). |

### Payroll
| Legacy Screen | Legacy Route | Current Route | Route | UI | Fields | Flow | Validation | API/DB | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Loan | `/guard/accountLoan` | `/payroll/operations/loan` | 🟩 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| Extra Hours | `/guard/payrollExtraHours` | `/payroll/operations/extra-hours` | 🟩 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| Other Deductions | `/guard/payrollOtherDeductions` | `/payroll/operations/other-deductions` | 🟩 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| Special Duty | `/guard/payrollSpecialDuty` | `/payroll/operations/special-duty` | 🟩 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| Holidays | `/guard/payrollHolidays` | `/payroll/operations/holidays` | 🟩 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| Salary V2 | `/salary-v2` | `/payroll/operations/salary-v2` | 🟩 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |

### Remaining Modules (to be expanded as each pass starts)
- Inventory
- Users & Access
- Reports
- Imports
- Settings/System
- Ticketing
- Requisitions
- Audit

---

## Current Sprint Tasks (Immediate)
- [x] Fix Add Guard collapsible sections and remove-row controls.
- [x] Build legacy-style Client Profile V2 tab structure on `/clients/[id]`.
- [ ] Complete exact field/label/action parity for Client Profile V2 against legacy screenshots. (major tab/section structure aligned; remaining deep field-action parity pending)
- [ ] Start Guards full parity pass (screen-by-screen) from `Add Guard` then `Search Guard`. (in progress)
- [x] Search Guard filter matrix parity pass (legacy labels + dropdowns + flow wiring).
- [x] Search Client + Search Client V2 filter/table parity pass.
- [ ] Update module snapshot after each completed screen.

## Execution Board (V2 Only)
1. `Guards/Add Guard`: finish exact dropdown-option parity and validation messages.
2. `Guards/Search Guard`: verify option lists against legacy extracts and align table action parity.
3. `Clients/Profile V2`: complete tab-level field/action parity (branches, pricing, inventory, contact).
4. `Clients/Search`: align exact legacy filter controls (`show`, `search`, `select date`) and export actions. (completed)
5. `Clients/Profile V2`: finish exact branch/pricing/inventory/contact field+action parity against legacy capture. (in progress)
6. `Clients/Export Branches`: complete checkbox-level mapping semantics and export payload parity.
7. `Clients/Invoice Prerequisites`: complete action-level parity (`Yes/No` confirms, edit-rate modal behavior). (completed)
8. `Clients/Invoiced Billings`: complete confirm modal parity (`Yes/No`, `SUBMIT`, `CLOSE`) and payment workflow details. (completed)
9. Next: continue client module parity pass (`Types & Locations`, `Export Client Branches option audit`, `Client Profile V2 deep field parity`) and then update module snapshot.
10. After each screen: update row status + evidence note in this checklist before moving on.

## Changelog
- 2026-02-22: Created master checklist to track exact legacy replication with module and screen gates.
- 2026-02-22: Logged Add Guard collapsible/remove-row and Client Profile V2 tab migration as in-progress tasks.
- 2026-02-22: Advanced `Search Guard` parity with legacy filter/dropdown/checkbox set and marked flow as in progress.
- 2026-02-22: Completed `Search Client` and `Search Client V2` filter/table/action parity pass and promoted both rows to in-progress.
- 2026-02-22: Expanded `Client Profile V2` with legacy-missing tabs and contact-information subsection blocks; flow moved to in-progress.
- 2026-02-22: Advanced `Export Client Branches` to legacy structure with manager/client selectors, checkbox matrix, and simulated submit/export flow.
- 2026-02-22: Advanced `Invoice Prerequisites` with legacy tab/field/dropdown/table parity and frontend flow feedback.
- 2026-02-22: Advanced `Invoiced Billings` with legacy filter matrix, invoiced/error tabs, and row-level actions including simulated post/update/payment flows.
- 2026-02-22: Added modal-level parity for `Invoice Prerequisites` and `Invoiced Billings` (`Yes/No`, `SUBMIT`, `CLOSE`) to align legacy confirmation workflows.
- 2026-02-22: Advanced `Export Guard` with legacy field/dropdown set, `Show/Search/Select Date`, and confirmation-based reset/submit/export flow.
- 2026-02-22: Advanced `Guards Prerequisites` with legacy section blocks and CWFE/allowance/document/status tables.
- 2026-02-22: Advanced `Black Listed Guards` and `Inactive Guards` with legacy-style `Show/Search/Select Date` controls, confirm modals (`Yes/No`), and inline feedback flows.
- 2026-02-22: Advanced `Attendance` with bulk mark (multi-select), CSV upload flow, and null-safe row rendering for guard-linked records.
- 2026-02-22: Advanced `Client Attendance` with legacy table controls, null-safe rendering for relational fields, and stable filtered listing behavior.
- 2026-02-22: Advanced `Deployment Rate` with legacy table controls (`Show`, `Search`, `Select Date`) on recent rate listings.
- 2026-02-22: Advanced `Deploy Guards` with `Day/Night/Both` shift parity and consistent success/error feedback behavior.
- 2026-02-22: Advanced `Residences`, `Assign Residence`, and unified `On Job Trainings (V2)` flows with legacy-style controls, shared action components, and stable filtered listing behavior.
- 2026-02-22: Advanced `Search Guard` table flow with legacy-style row actions (`View`, `Edit`, `Activate/Deactivate`) and corrected `Show` control labeling.
- 2026-02-22: Advanced `Guards Prerequisites` action-level parity with editable prerequisite modal and status-toggle confirmation workflow.
- 2026-02-22: Advanced `Add Guard` checklist/field parity with controlled pre-requisite `Select All`, added `parwest_shortname`, and explicit `EX` marker in previous-employment radios.
- 2026-02-22: Advanced `Export Guard` action parity by adding `Cancel` confirmation flow (alongside existing `Reset`/`Submit` confirms).
- 2026-02-22: Added legacy fallback option sets to `Deploy Guards` and `Deployment Rate` so region/client dropdown parity remains stable in mock/sparse API scenarios.
- 2026-02-22: Added `Client Attendance` fallback legacy option lists (regional offices/clients) and `On Job Trainings` legacy dropdown option sets (regional office/client/branch).
- 2026-02-22: Added `Add Guard` client-side validation parity for CNIC/phone/age format checks with explicit legacy-style error messaging.
- 2026-02-22: Expanded `Export Guard` dropdown parity with broader legacy supervisor/status/ex-service/verification option sets.
- 2026-02-22: Expanded `Deploy Guards` fallback option parity (offices/clients/branches/guards) and added `Deployment Rate` ex-service field + option/query wiring.
- 2026-02-22: Advanced `Black Listed Clients` parity with legacy controls (`Show`, `Search`, `Add/Reset/Submit`) and confirmation workflows.
