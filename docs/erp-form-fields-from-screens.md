# ERP Form Fields Catalog From Screens

Sources used: `UI-Screens-Docs-1.2.docx`, `docs/erp-admin-flow-spec.md`, `docs/erp-docx-to-live-mapping.md`, and live captured metadata from staging screens.

Scope: Admin role, read-only exploration, discovery date `2026-02-09`.

## Screen-by-Screen Form Details

### Dashboard
- Route: `https://staging-erp.parwestgroup.com/map`
- Heading: `Dashboard`
- Form count: `0`
- Input controls (input/select/textarea): `2`
- Route status: `ok`
- Fields observed: None detected
- Primary actions: `✕ Cancel`, `Go`

### Add Guard Screen (FORMS)
- Route: `https://staging-erp.parwestgroup.com/guard/create`
- Heading: `Guard Enrolment Form`
- Form count: `1`
- Input controls (input/select/textarea): `82`
- Route status: `ok`
- Fields observed: `Select All`, `NADRA Verification`, `Health Certificate Verification`, `Police Verification`, `Eyesight Certificate`, `character verification`, `mental health check`, `3rd gurantor verysis`, `Company card & CNIC`, `Parwest ID*`, `Full Name *`, `FATHER'S NAME *`, `MOTHER'S NAME *`, `Date of Birth *`, `Age`, `CNIC # (FORMAT: xxxxx-xxxxxxx-x) *`, `CNIC Issue Date *`, `CNIC Expiry Date *`, `NEXT OF KIN *`, `Contact # (Format: +92-300-1234567) *`
- Primary actions: `✕ Cancel`, `Import`, `Submit`

### Search Guard Screen
- Route: `https://staging-erp.parwestgroup.com/guard/search`
- Heading: `Search Guard`
- Form count: `1`
- Input controls (input/select/textarea): `28`
- Route status: `ok`
- Fields observed: `Parwest ID`, `Name`, `CNIC#`, `Phone Number`, `Select Education`, `Select Relegion`, `Select Status`, `Select Client`, `Supervisor`, `Ex Service`, `Verification Type`, `Verification Status`, `Created From`, `Created To`, `Bank Name`, `Bank Account Status`, `Bank Card Status`, `Bank Account Type`, `Residence`, `Over Staying`
- Primary actions: `✕ Cancel`, `--Select Client--`, `--Select supervisor--`, `SEARCH!`, `Clear Filter`, `Export Short Role In Excel`, `Export In Bank Details`, `Export In Excel`, `Cancel`, `×`, `Reset`, `Submit`

### Guard Profile Screen (from Search Guard)
- Route: `https://staging-erp.parwestgroup.com/guard/show/31367`
- Heading: `Whoops, looks like something went wrong.`
- Form count: `0`
- Input controls (input/select/textarea): `0`
- Status: `Broken (exception page)`
- Notes: Guard profile route currently opens a Laravel exception page; form fields are not renderable.

### Prerequisites Selection and Activation (Super Admin)
- Route: `https://staging-erp.parwestgroup.com/guard/mergedOptions`
- Heading: `Guard Statuses`
- Form count: `1`
- Input controls (input/select/textarea): `1`
- Route status: `ok`
- Fields observed: None detected
- Primary actions: `✕ Cancel`, `×`, `Cancel`, `Add`

### Export Guards to Excel
- Route: `https://staging-erp.parwestgroup.com/searchByDataTable`
- Heading: `Search Guard`
- Form count: `0`
- Input controls (input/select/textarea): `14`
- Route status: `ok`
- Fields observed: `Parwest ID`, `Name`, `CNIC#`, `Select Status`, `Ex Service`, `Supervisor`, `Verification Status`, `Search:`, `Select Date`
- Primary actions: `✕ Cancel`, `--Select Status--`, `--Select Ex Service--`, `--Select Supervisor--`, `--Select Verification Status--`, `Clear Filter`, `Export to Excel`, `×`, `Reset`, `Submit`

### Black Listed Guards
- Route: `https://staging-erp.parwestgroup.com/guard/blackListedGuards`
- Heading: `Black Listed Guards`
- Form count: `1`
- Input controls (input/select/textarea): `3`
- Route status: `ok`
- Fields observed: `Cnic #`
- Primary actions: `✕ Cancel`, `×`, `Reset`, `Submit`

### Inactive Guards
- Route: `https://staging-erp.parwestgroup.com/guard/softDeletedGuardList`
- Heading: `Deactivated Guards`
- Form count: `0`
- Input controls (input/select/textarea): `4`
- Route status: `ok`
- Fields observed: `Show 102550100200 entries`, `Search:`, `Select Date`
- Primary actions: `✕ Cancel`, `×`, `Reset`, `Submit`

### Deploy Guard Screen
- Route: `https://staging-erp.parwestgroup.com/guard/GuardDeployment`
- Heading: `Deploy Guards`
- Form count: `3`
- Input controls (input/select/textarea): `44`
- Route status: `ok`
- Fields observed: `Region`, `Select Client`, `Branch`, `Deploy as`, `Select Guard`, `Guard's Name`, `Guard's Designations`, `Guard's Type`, `Salary`, `Overtime`, `Extra Hours`, `Post Allowance`, `Day Shift Start`, `Day Shift End`, `Night Shift Start`, `Night Shift End`, `Deployment Date`, `Guard Deployment Status*`, `Day`, `Night`
- Primary actions: `✕ Cancel`, `--Select Region--`, `--Select Client--`, `Nothing selected`, `Save`, `×`, `Revoke Deployment`, `Change Deployment`

### Deployment Rates Setting
- Route: `https://staging-erp.parwestgroup.com/guard/GuardDeploymentRate`
- Heading: `Deployments Rate Updation`
- Form count: `1`
- Input controls (input/select/textarea): `17`
- Route status: `ok`
- Fields observed: `Region`, `Client`, `Branch`, `Deploy as`, `Guard's Type`, `Shift`, `Day`, `Night`, `Both`, `Salary`, `Overtime`, `Extra Hours`, `Post Allowance`
- Primary actions: `✕ Cancel`, `--Select Region--`, `--Select Client--`, `Nothing selected`, `Get Previous Rates`, `Save`

### Guard Attendance
- Route: `https://staging-erp.parwestgroup.com/guard/attendance`
- Heading: `Attendance`
- Form count: `1`
- Input controls (input/select/textarea): `3`
- Route status: `ok`
- Fields observed: `Secure Ops ID*`, `Strat Date*`, `End Date*`
- Primary actions: `✕ Cancel`, `Submit`

### Client Attendance
- Route: `https://staging-erp.parwestgroup.com/guard/clientAttendance`
- Heading: `Client Attendance`
- Form count: `1`
- Input controls (input/select/textarea): `8`
- Route status: `ok`
- Fields observed: `Regional Offices`, `Select Client`, `Select Branch`, `Start Date*`, `End Date*`
- Primary actions: `✕ Cancel`, `head office lahore`, `--Select Client--`, `--Select Branch--`, `Submit`

### Guard Residencies List
- Route: `https://staging-erp.parwestgroup.com/guard/residences`
- Heading: `Add Residence`
- Form count: `2`
- Input controls (input/select/textarea): `12`
- Route status: `ok`
- Fields observed: `Show 102550100 entries`, `Search:`, `Address`, `Owner Name`, `Owner Phone`, `Select Supervisor`
- Primary actions: `✕ Cancel`, `Create New`, `×`, `Add`, `Update`

### Assign Residency to Guard
- Route: `https://staging-erp.parwestgroup.com/guard/residences/assign`
- Heading: `Assign Residence`
- Form count: `2`
- Input controls (input/select/textarea): `14`
- Route status: `ok`
- Fields observed: `Select Supervisor`, `Residences`, `Select Guard`, `Guard's Name`, `Guard's Designations`, `Guard's Type`, `Assign Date`, `Revoke Date`, `Comment`
- Primary actions: `✕ Cancel`, `--Select Supervisor--`, `Nothing selected`, `Save`, `×`, `Revoke Residence`

### Guard Training Module (Onjob Trainings)
- Route: `https://staging-erp.parwestgroup.com/guard/onjob-trainings`
- Heading: `On Job Training`
- Form count: `12`
- Input controls (input/select/textarea): `42`
- Route status: `ok`
- Fields observed: `Select Regional Office`, `Select Client`, `Branch`, `From Date`, `To Date`, `Items per page:`, `Armorer`, `Supervisor Has Uniform`, `Yes`, `No`
- Primary actions: `✕ Cancel`, `--Select Regional Office--`, `--Select Client--`, `--Select Branch--`, `Filter`, `Clear`, `Add New Training`, `Export All OJT Report`, `Export Filtered OJT Report`, `Branch Training Report`, `Export Branch Report`, `Export Summary`, `2 Guards`, `View`, `Edit OJT`, `Delete`, `3 Guards`

### Add New Client Screen
- Route: `https://staging-erp.parwestgroup.com/client/create`
- Heading: `Client Enrolment Form`
- Form count: `1`
- Input controls (input/select/textarea): `35`
- Route status: `ok`
- Fields observed: `Client's Name *`, `Client's Email *`, `Client Type`, `Enrollment Date* (Please Enter Correct Enrollment Date For Accurate Reporting)`, `Contact Person *`, `Contact Number *`, `Client Location`, `Client's Postal Code`, `Head Office Address *`, `Name`, `Contact Number`, `Address`, `Cnic Number`, `License Number`, `Serial Number`, `Operational Provinces`, `Location Name`, `Select Regional Office`, `Latitude`, `Longitude`
- Primary actions: `✕ Cancel`, `Select Operational Territory`, `All Pakistan`, `Deselect All`, `Submit`, `×`, `Cancel`

### Search Client Screen
- Route: `https://staging-erp.parwestgroup.com/client/searchResult`
- Heading: `Client Search Results`
- Form count: `11`
- Input controls (input/select/textarea): `7`
- Route status: `ok`
- Fields observed: `Name`, `Select Client Type`, `Select City`, `Show 102550100200 entries`, `Search:`, `Select Date`
- Primary actions: `✕ Cancel`, `Search`, `Export In Excel`, `×`, `Reset`, `Submit`

### Search Client Screen V2
- Route: `https://staging-erp.parwestgroup.com/client/v2/search`
- Heading: `Search Clients V2`
- Form count: `0`
- Input controls (input/select/textarea): `7`
- Route status: `ok`
- Fields observed: `Name`, `Select Client Type`, `Select City`, `Show 102550100 entries per page`, `Search:`, `Select Date`
- Primary actions: `✕ Cancel`, `Search`, `Clear`, `×`, `Close`, `Update Status`

### Client Profile Screen
- Route: `https://staging-erp.parwestgroup.com/client/show/327`
- Heading: `Kothi No 11 Nisar Colony Samnabad Faisalabad 's Profile`
- Form count: `4`
- Input controls (input/select/textarea): `166`
- Tabs: `General Information`, `Assigned Guards`, `Extra Guards`, `Branches`, `Pricing`, `Attachments`, `Inventory`, `Contact Information`, `Client Invoicing`, `Basic Information`, `Contact Person Info`, `Branch Manager's Information`, `Operations Manager's Information`, `Supervisor's Information`
- Fields observed: `Upload Picture`, `Select Supervisor`, `Select Manager`, `Select Date`, `Show 102550100 entries per page`, `Search:`, `Branch*`, `Start Date`, `End Date`, `Show 102550100200 entries`, `Document Name`, `Parwest`, `Provinces *`, `Cities *`, `Branches *`, `Invoice Month *`, `Name`, `Tax Percentage`, `Name Of Branch *`, `Branch Code`, `Latitude *`, `Longitude *`, `Select Regional Office`, `Select City`, `Day CPO's Required*`, `Night CPO's Required*`, `Day SO Capacity*`, `Night SO Capacity*`, `Day ASO Capacity*`, `Night ASO Capacity*`, `Day LSO Capacity*`, `Night LSO Capacity*`, `Day Supervisors Required*`, `Night Supervisors Required*`, `Day Guards *`, `Night Guards*`, `Day CCTV Operators*`, `Night CCTV Operators*`, `Day Receptionists*`, `Night Receptionists*`, `Branch Enrollment Date*`, `Locker Branch *`, `Yes`, `No`, `NAME`, `CNIC #`, `PHONE NUMBER`, `NUMBER`, `EMAIL`, `CONTACT NUMBER`, `Manager *`, `Manager Contact Number *`, `Supervisor *`, `Supervisor Contact Number *`, `Select Branch City`, `CPO's Required*`, `Guard Capacity Change Date*`, `Branch Opening Date*`, `EMAIL *`, `Manager Contact Number`, `Supervisor Contact Number`, `CONTRACT START DATE`, `CONTRACT EXPIRY DATE`, `Contract Type`, `CONTRACT NAME`, `Client Provinces`, `Client Cities`, `Guard Types`, `Effective Rate`, `Guard Ex-Services`, `Extra Hours Rate / Hour`, `Enqueue`, `Criteria`, `Extra Hours Rate`, `Remove`, `Province`, `City`, `Guard Type`
- Primary actions: `✕ Cancel`, `×`, `Reset`, `Submit`, `Export In Excel File`, `CENTRALIZED INVOICE`, `Select Provinces`, `All Operational Provinces`, `Deselect All`, `Select Cities`, `All Cities`, `Select Branches`, `All Branches`, `Download Invoice`, `Generate Invoice`, `Dismiss`, `Save`, `Close`

### Client Profile Screen V2
- Route: `https://staging-erp.parwestgroup.com/client/v2/show/327`
- Heading: `Kothi No 11 Nisar Colony Samnabad Faisalabad - Profile V2`
- Form count: `1`
- Input controls (input/select/textarea): `127`
- Tabs: `General Information`, `Assigned Guards`, `Extra Guards`, `Branches`, `Pricing`, `Inventory`, `Contact Information`, `Basic Information`, `Contact Person Info`, `Branch Manager's Information`, `Operations Manager's Information`, `Supervisor's Information`
- Fields observed: `Upload Picture`, `Select Supervisor`, `Select Manager`, `Select Date`, `Show 102550100 entries per page`, `Search:`, `Branch`, `Start Date`, `End Date`, `Name Of Branch *`, `Branch Code`, `Latitude *`, `Longitude *`, `Select Regional Office`, `Select Branch City`, `CPO's Required*`, `Night CPO's Required*`, `Day Supervisors Required*`, `Night Supervisors Required*`, `Day Guards *`, `Night Guards*`, `Guard Capacity Change Date*`, `Day SO Capacity*`, `Night SO Capacity*`, `Day ASO Capacity*`, `Night ASO Capacity*`, `Day LSO Capacity*`, `Night LSO Capacity*`, `Day CCTV Operators*`, `Night CCTV Operators*`, `Day Receptionists*`, `Night Receptionists*`, `Branch Opening Date*`, `Locker Branch *`, `Yes`, `No`, `NAME`, `CNIC #`, `PHONE NUMBER`, `NUMBER`, `EMAIL`, `EMAIL *`, `Manager *`, `Manager Contact Number`, `Supervisor *`, `Supervisor Contact Number`, `Select City`, `Day CPO's Required*`, `Branch Enrollment Date*`, `CONTACT NUMBER`, `Manager Contact Number *`, `Supervisor Contact Number *`, `CONTRACT START DATE`, `CONTRACT EXPIRY DATE`, `Contract Type`, `CONTRACT NAME`, `Client Provinces`, `Client Cities`, `Guard Types`, `Effective Rate`, `Guard Ex-Services`, `Extra Hours Rate / Hour`, `Enqueue`, `Criteria`, `Extra Hours Rate`, `Remove`, `Province`, `City`, `Guard Type`, `Ex Services`, `Guard Price`, `Ex Price/ H`, `Ex-Services`, `Ex Price/H`
- Primary actions: `✕ Cancel`, `×`, `Reset`, `Submit`, `Export In Excel File`, `Clear`, `Dismiss`, `Save`, `Close`

### Client Types and Locations
- Route: `https://staging-erp.parwestgroup.com/client/typeList`
- Heading: `All Client Types`
- Form count: `0`
- Input controls (input/select/textarea): `0`
- Route status: `ok`
- Fields observed: None detected
- Primary actions: `✕ Cancel`

### Black Listed Clients
- Route: `https://staging-erp.parwestgroup.com/client/blackListedClients`
- Heading: `Black Listed Clients`
- Form count: `1`
- Input controls (input/select/textarea): `1`
- Route status: `ok`
- Fields observed: `Email`
- Primary actions: `✕ Cancel`, `×`, `Reset`, `Submit`

### Export Clients/Branches
- Route: `https://staging-erp.parwestgroup.com/client/exportClientBranches`
- Heading: `Export Client Branches`
- Form count: `1`
- Input controls (input/select/textarea): `74`
- Route status: `ok`
- Fields observed: `Select Manager`, `Select Client`
- Primary actions: `✕ Cancel`, `Submit`

### Client Invoice Pre-requisites
- Route: `https://staging-erp.parwestgroup.com/client/invoicePrerequisites`
- Heading: `Contract Default Rates`
- Form count: `0`
- Input controls (input/select/textarea): `26`
- Route status: `ok`
- Fields observed: `Select Province`, `Select City`, `Select Guard Type`, `Show 102550100200 entries`, `Search:`, `Client Province`, `Client Cities`, `Guard Types`, `Effective Rate`, `Enqueue`, `Edit Rate`, `Name`, `Province`, `ID`, `Province Name`
- Primary actions: `✕ Cancel`, `SEARCH!`, `×`, `Reset`, `Submit`, `Yes`, `No`

### Invoiced Billing Screen of Clients
- Route: `https://staging-erp.parwestgroup.com/client/invoicedBillings`
- Heading: `Invoices`
- Form count: `4`
- Input controls (input/select/textarea): `32`
- Route status: `ok`
- Fields observed: `Select Client`, `Select Branch`, `Select Invoice Month`, `Select Invoices From`, `Select Invoices To`, `Invoice Due Date`, `Select Invoice Status`, `Show 102550100200 entries`, `Search:`, `Add Payment`
- Primary actions: `✕ Cancel`, `--Select Client--`, `--Select Branch--`, `--Select Invoice Status--`, `Search`, `Post`, `Pay`, `×`, `Yes`, `No`, `Update`, `SUBMIT`, `CLOSE`

## Notes

- Several list/report screens expose filter forms; they are included as form fields where controls were detected.
- `Guard Profile Screen` is currently broken in staging (`Whoops` exception), so its expected 18 sub-screen form fields could not be enumerated from live UI.
- Client profile screens (`/client/show/{id}` and `/client/v2/show/{id}`) include multi-tab forms; fields listed above are the labels visible in sampled profile `327`.
