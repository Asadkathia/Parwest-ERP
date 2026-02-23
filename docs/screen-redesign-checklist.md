# Legacy Screen Redesign Checklist

Purpose: Track screen-by-screen replication of legacy ERP behavior.
Rule: When a screen is fully replicated (layout + fields + flow), mark it crossed out and checked.

Primary tracker: `docs/legacy-replication-master-checklist.md`
Use the master tracker for task-level completion, module completion, and parity gates.

## Guards
- [x] ~~Add Guard (`/guard/create` -> `/guards/new`)~~
- [x] ~~Search Guard (`/guard/search` -> `/guards/search`)~~
- [x] ~~Export Guard (`/searchByDataTable` -> `/guards/export`)~~
- [x] ~~Prerequisites (`/guard/mergedOptions` -> `/guards/prerequisites`)~~
- [x] ~~Black Listed Guards (`/guard/blackListedGuards` -> `/guards/blacklist`)~~
- [x] ~~Inactive Guards (`/guard/softDeletedGuardList` -> `/guards/inactive`)~~
- [x] ~~Deploy Guards (`/guard/GuardDeployment` -> `/guards/deploy`)~~
- [x] ~~Deployment Rate (`/guard/GuardDeploymentRate` -> `/guards/deployments-rate`)~~
- [x] ~~Guard Attendance (`/guard/attendance` -> `/guards/attendance`)~~
- [x] ~~Client Attendance (`/guard/clientAttendance` -> `/guards/client-attendance`)~~
- [x] ~~Residences (`/guard/residences` -> `/guards/residences`)~~
- [x] ~~Assign Residence (`/guard/residences/assign` -> `/guards/assign-residence`)~~
- [x] ~~On Job Trainings (`/guard/onjob-trainings` -> `/guards/trainings`)~~

## Clients
- [x] ~~Add New Client (`/client/create` -> `/clients/new`)~~
- [x] ~~Search Client (`/client/searchResult` -> `/clients/search`)~~
- [x] ~~Search Client V2 (`/client/v2/search` -> `/clients/search-v2`)~~
- [x] ~~Types & Locations (`/client/typeList` -> `/clients/types-locations`)~~
- [x] ~~Black Listed Clients (`/client/blackListedClients` -> `/clients/blacklist`)~~
- [x] ~~Export Client Branches (`/client/exportClientBranches` -> `/clients/export-branches`)~~
- [x] ~~Invoice Prerequisites (`/client/invoicePrerequisites` -> `/clients/invoice-prerequisites`)~~
- [x] ~~Invoiced Billings (`/client/invoicedBillings` -> `/clients/invoiced-billings`)~~

## Payroll
- [x] ~~Loan (`/guard/accountLoan` -> `/payroll/operations/loan`)~~
- [x] ~~Extra Hours (`/guard/payrollExtraHours` -> `/payroll/operations/extra-hours`)~~
- [x] ~~Other Deductions (`/guard/payrollOtherDeductions` -> `/payroll/operations/other-deductions`)~~
- [x] ~~Special Duty (`/guard/payrollSpecialDuty` -> `/payroll/operations/special-duty`)~~
- [x] ~~Holidays (`/guard/payrollHolidays` -> `/payroll/operations/holidays`)~~
- [x] ~~Salary V2 (`/salary-v2` -> `/payroll/operations/salary-v2`)~~
- [x] ~~Unpaid Salary (`/guard/accountUnPaid` -> `/payroll/operations/unpaid-salaries`)~~
- [x] ~~Bulk Salary Slip (`/guard/bulk-salary-slip` -> `/payroll/operations/bulk-salary-slips`)~~
- [x] ~~Clearance (`/guard/accountClearance` -> `/payroll/operations/clearance`)~~

## Users
- [x] ~~Add User (`/user/create` -> `/users/new`)~~
- [x] ~~Search User (`/user/searchForm` -> `/users/search`)~~
- [x] ~~M/S Relationship (`/user/assignManagerToSupervisorForm` -> `/users/ms-relationship`)~~
- [x] ~~C/S Relationship (`/user/assignClientsBranchToSupervisorForm` -> `/users/cs-relationship`)~~
- [x] ~~Switch Supervisor (`/user/switchManagerForm` -> `/users/switch-supervisor`)~~

## Inventory
- [x] ~~Dashboard (`/inventory/dashboard` -> `/inventory`)~~
- [x] ~~Search (`/inventory/searchCustom` -> `/inventory/search`)~~
- [x] ~~Stock In (`/inventory/createProduct` -> `/inventory/stock-in`)~~
- [x] ~~Categories (`/inventory/categoryList` -> `/inventory/categories`)~~
- [x] ~~Vendors (`/inventory/vendorList` -> `/inventory/vendors`)~~
- [x] ~~Conditions (`/inventory/conditionList` -> `/inventory/conditions`)~~
- [x] ~~Demand (`/inventory/demandInventoryForm` -> `/inventory/demand`)~~
- [x] ~~Assign Item (`/inventory/assignProductFormNew` -> `/inventory/assign-item`)~~
- [x] ~~Condemned Items (`/inventory/condemnedItems` -> `/inventory/condemned`)~~

## Note
- This checklist tracks UI/UX replication only (frontend-first).
- API/DB behavior should be validated in a separate backend parity pass.
