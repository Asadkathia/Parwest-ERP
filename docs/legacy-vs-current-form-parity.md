# Form Parity Audit: Legacy ERP vs Current ERP

- Source legacy crawl: `artifacts/legacy-audit/legacy-audit.json`
- Total legacy menu routes: **104**
- Routes with direct mapping to current ERP: **62**
- Routes with no mapping (form not added as equivalent): **42**
- Mapped routes with detected legacy form fields: **24**
- Average field match on mapped form routes: **17.4%**
- Status counts: MATCHED **0**, PARTIAL **4**, LOW_COVERAGE **20**

## High-Priority Form Gaps (Mapped but not fully matched)
- /guard/accountClearance -> /payroll/operations/clearance: 0% (0/10)
  missing sample: Secure Ops ID *, Guard Name, Status, Type, Current Location, Loan, Month *, Other Deduction, Payment Date *, Slip Number *
- /guard/accountLoan -> /payroll/operations/loan: 0% (0/31)
  missing sample: Month *, Parwest ID * -, Name, Phone Number, Client, Branch Name, Days, Double Duty Days, Current Supervisor, guards_current_supervisor_id
- /guard/accountSalaryExport -> /payroll/reports: 0% (0/4)
  missing sample: Month *, region, manager[], supervisor[]
- /guard/accountSalaryExportUnpaid -> /payroll/reports: 0% (0/7)
  missing sample: Secure Ops ID *, Guard Name, Status, Type, Current Location, Month *, SALARY Status
- /guard/accountUnPaid -> /payroll/operations/unpaid-salaries: 0% (0/6)
  missing sample: Parwest ID *, Name, Salary Status, Date *, Change Status *, Remarks *
- /guard/blackListedGuards -> /guards/blacklist: 0% (0/1)
  missing sample: Cnic #
- /guard/bulk-salary-slip -> /payroll/operations/bulk-salary-slips: 0% (0/17)
  missing sample: salary_month, salary_file, Earnings, Select All, Basic Salary, Working Days, Paid Working Days, Overtime / Hours, Gazetted Holidays, Arrears
- /guard/payrollHolidays -> /payroll/operations/holidays: 0% (0/11)
  missing sample: Regional Offices, from_date, to_date, Fixed per day amount, Multiple of location Rate, Value, Status, comments, unique_id, edit_from_date
- /guard/payrollSpecialDuty -> /payroll/operations/special-duty: 0% (0/20)
  missing sample: parwest_id, special_duty_guard_name, special_duty_guard_type, special_duty_guard_status, special_duty_from_date, special_duty_to_date, special_duty_hours, special_duty_hour_rate, special_duty_remarks, special_duty
- /guard/salarySummary -> /payroll/reports: 0% (0/3)
  missing sample: _token, salary_month, regional_office
- /guard/payrollExtraHours -> /payroll/operations/extra-hours: 9.1% (1/11)
  missing sample: Secure Ops ID, Guard Name, Status, Type, Current Location, extrahour_guards_client, extrahour_guards_branch, unique_id, edit_extrahour_guards_client, edit_extrahour_guards_branch
- /guard/payrollOtherDeductions -> /payroll/operations/other-deductions: 12.5% (1/8)
  missing sample: Secure Ops ID, Guard Name, Status, Type, Current Location, Dated, unique_id
- /guard/accountSalary -> /payroll/operations/salary-v2: 20% (1/5)
  missing sample: _token, regions, client_id, branch_id
- /guard/onjob-trainings -> /guards/trainings: 20% (2/10)
  missing sample: regional_office_id, client_id, branch_id, Armorer, Yes, No, _token, _method
- /guard/create -> /guards/new: 21.1% (12/57)
  missing sample: _token, Cnic #, parwest_shortname, parwest_shortname_hidden, Full Name *, Contact # (Format: +92-300-1234567) *, PASSPORT #, Passport Expiry Date, SECT *, CAST *
- /salary-v2 -> /payroll/operations/salary-v2: 25% (1/4)
  missing sample: Salary Month *, Regional Office, select-all-branches
- /guard/GuardDeployment -> /guards/deploy: 27.3% (9/33)
  missing sample: check_deploy, region_id_on_user_profile, client_id_on_user_profile, branch_id_on_user_profile, Deploy as, Select Guard, Guard's Name, Guard's Designations, Guard's Type, Deployment Date
- /guard/residences/assign -> /guards/assign-residence: 27.3% (3/11)
  missing sample: check_deploy, supervisor_id_on_user_profile, residence_id, Guard's Name, Guard's Designations, Guard's Type, Revoke Date, comment
- /guard/onjob-trainings-v2 -> /guards/trainings: 28.6% (2/7)
  missing sample: regional_office_id, client_id, branch_id, _token, _method
- /guard/attendance -> /guards/attendance: 33.3% (1/3)
  missing sample: Secure Ops ID, Strat Date*
- /guard/clientAttendance -> /guards/client-attendance: 40% (2/5)
  missing sample: edit_regional_office, selected_client, client_branches
- /guard/search -> /guards/search: 45.5% (10/22)
  missing sample: Parwest ID, Name, CNIC#, Phone Number, Select Education, Select Relegion, Select Status, client_id, supervisor_id, isOverstaying
- /guard/GuardDeploymentRate -> /guards/deployments-rate: 50% (5/10)
  missing sample: region_id_on_user_profile, client_id_on_user_profile, branch_id_on_user_profile, deployGuardAsDesignation[], exService
- /guard/residences -> /guards/residences: 57.1% (4/7)
  missing sample: Show 102550100 entries, _token, Select Supervisor

## Missing Form Routes (No current equivalent mapping)
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
- This audit is field-label based and conservative; dynamic labels or modal-only fields may be undercounted.
- For dynamic parity screens, labels were extracted from `src/lib/parity/screenConfigs.ts`; for concrete pages, labels/placeholders were extracted from route files.
- Use `docs/legacy-vs-current-form-parity.csv` for full per-route detail.
