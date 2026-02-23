# Legacy vs Current ERP Replication Report

## Coverage Snapshot
- Legacy routes discovered from staging menu: **104**
- Mapped and currently replicated routes: **62**
- Overall route-level replication: **59.6%**
- Replication for mapped legacy endpoints only: **62/62 (100.0%)**

## Module Breakdown
- Audit: 0/1 (0.0%)
- Imports: 0/15 (0.0%)
- Clients: 8/9 (88.9%)
- Guards: 33/37 (89.2%)
- Inventory: 9/10 (90.0%)
- Dashboard: 1/1 (100.0%)
- Settings/System: 2/2 (100.0%)
- Reports: 0/15 (0.0%)
- Payroll: 1/2 (50.0%)
- Ticketing: 1/1 (100.0%)
- Users & Access: 7/11 (63.6%)

## Major Gaps To Reach Exact Legacy Parity
- /audit/auditSearch
- /bulkImport/clients/addBranches
- /bulkImport/clients/addClients
- /bulkImport/guards/addBankDetailsBulkImport
- /bulkImport/guards/addEmploymentHistoryBulkImport
- /bulkImport/guards/addFamilyBulkImport
- /bulkImport/guards/addJudicialCasesBulkImport
- /bulkImport/guards/addLoanDetailsBulkImport
- /bulkImport/guards/addNearestRelativeBulkImport
- /bulkImport/guards/addPledgedDocumentBulkImport
- /bulkImport/guards/addVerificationsBulkImport
- /bulkImport/guards/markAttendanceBulkImport
- /bulkImport/inventory/inventoryBulkAssignPage
- /bulkImport/inventory/inventoryBulkImportPage
- /bulkImport/inventory/inventoryBulkUpdatePage
- /bulkImport/users/addUserBulkImport
- /client/clientInsuranceSettings
- /guard/mergedOptions
- /guard/status-update
- /reports/client-branch-deactive-report
- /reports/client-summary
- /reports/clientEnrolledreports
- /reports/clients/client-branch-increase-decrease-report
- /reports/dailyUserReport
- /reports/dailydeploymentreport
- /reports/dayNightDutyGuards
- /reports/finalized-paid-loan
- /reports/guardDeploymentreports
- /reports/guardEnrolledreports
- /reports/guards
- /reports/managers-supervisors-guards
- /reports/scheduledreports
- /reports/shortdeployment
- /reports/unassignguards
- /user/guardVerificationStatusesList
- /user/guardVerificationTypesList
- /user/updateLogos

## Full Unmatched List
- /audit/auditSearch
- /bulkImport/clients/addBranches
- /bulkImport/clients/addClients
- /bulkImport/guards/addBankDetailsBulkImport
- /bulkImport/guards/addEmploymentHistoryBulkImport
- /bulkImport/guards/addFamilyBulkImport
- /bulkImport/guards/addJudicialCasesBulkImport
- /bulkImport/guards/addLoanDetailsBulkImport
- /bulkImport/guards/addNearestRelativeBulkImport
- /bulkImport/guards/addPledgedDocumentBulkImport
- /bulkImport/guards/addVerificationsBulkImport
- /bulkImport/guards/markAttendanceBulkImport
- /bulkImport/inventory/inventoryBulkAssignPage
- /bulkImport/inventory/inventoryBulkImportPage
- /bulkImport/inventory/inventoryBulkUpdatePage
- /bulkImport/users/addUserBulkImport
- /client/clientInsuranceSettings
- /guard/acceptedRejectedByCol
- /guard/mergedOptions
- /guard/onjob-training-intervals
- /guard/status-update
- /inventory/inventory-report
- /reports/client-branch-deactive-report
- /reports/client-summary
- /reports/clientEnrolledreports
- /reports/clients/client-branch-increase-decrease-report
- /reports/dailyUserReport
- /reports/dailydeploymentreport
- /reports/dayNightDutyGuards
- /reports/finalized-paid-loan
- /reports/guardDeploymentreports
- /reports/guardEnrolledreports
- /reports/guards
- /reports/managers-supervisors-guards
- /reports/scheduledreports
- /reports/shortdeployment
- /reports/unassignguards
- /searchByDataTable
- /user/guardVerificationStatusesList
- /user/guardVerificationTypesList
- /user/profile
- /user/updateLogos

## Notes
- This comparison is based on live staging crawl + current Next.js route structure.
- Dynamic route handlers (/payroll/operations/[screen], /inventory/[screen], /reports/[screen]) are counted as replicated when mapped subpaths exist.
- Exact workflow parity still requires manual UAT for create/edit/approve/export/import actions and modal behavior.
- Artifacts: `artifacts/legacy-audit/legacy-audit.json`, `artifacts/legacy-audit/legacy-routes.csv`, `docs/legacy-vs-current-route-parity.csv`, `docs/legacy-erp-page-catalog.md`.
