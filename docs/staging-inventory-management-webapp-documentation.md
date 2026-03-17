# Staging Inventory Management System: Authenticated Screen and Workflow Documentation

- Environment: `https://staging-store.parwestgroup.com`
- Audit date: 2026-03-16
- Authentication status: Success
- Verified login used in this pass: `admin@parwestgroup.com` / `admin123@`
- Total authenticated screens verified: 31
- Total URLs crawled during pass: 63

## Verification Method

- Performed authenticated session login via real staging form and CSRF flow.
- Crawled internal links from the authenticated dashboard using read-only GET requests.
- Extracted per-page metadata: title, headings, table columns, buttons, form actions, and fields.
- Excluded template placeholder links and static asset paths from the final screen catalog.

## Module and Screen Index

### Dashboard

- `/` - Dashboard | Parwest Store Managment

### Administration

- `/roles` - Roles | Parwest Store Managment
- `/roles/create` - Add Role | Parwest Store Managment
- `/users` - users | Parwest Store Managment

### Store Structure

- `/employee-inventory-assignments` - Employee Assignments | Parwest Store Management
- `/stores` - Stores | Parwest Store Managment

### Inventory Operations

- `/adjustments/create/regular` - Add Adjustment | Parwest Store Managment
- `/adjustments/regular` - Adjustments | Parwest Store Managment
- `/audits` - Audits | Parwest Store Managment
- `/inventories/regular` - Inventories | Parwest Store Managment
- `/inventory-assignements` - Assignement | Parwest Store Managment
- `/inventory-assignements/create` - Add Assignement | Parwest Store Managment

### Purchasing and Vendors

- `/demands_response` - Demands Responsed | Parwest Store Managment
- `/demands_send` - Demands | Parwest Store Managment
- `/demands_send/create` - Add Demands | Parwest Store Managment
- `/purchases/create/regular` - Add Purchase | Parwest Store Managment
- `/purchases/regular` - Purchase | Parwest Store Managment
- `/vendors` - Vendors | Parwest Store Managment

### Product Master Data

- `/brands` - Brands | Parwest Store Managment
- `/calibres` - Calibres | Parwest Store Managment
- `/categories` - Categories | Parwest Store Managment
- `/conditions` - Conditions | Parwest Store Managment
- `/licenses` - licenses | Parwest Store Managment
- `/product-unique-items` - Weapon Unique Items | Parwest Store Managment
- `/products` - Products | Parwest Store Managment
- `/products/create` - Add Product | Parwest Store Managment
- `/repairings` - Repairinges | Parwest Store Managment
- `/statuses` - Statuses | Parwest Store Managment
- `/units` - Units | Parwest Store Managment
- `/variations` - Variations | Parwest Store Managment
- `/weapon-types` - Weapon Types | Parwest Store Managment

## Verified Workflows

### 1. Authentication and Dashboard

- `GET /login` -> credentials submit -> redirect to authenticated dashboard (`/`).
- Dashboard renders KPI counters and direct navigation to operational modules.

### 2. Product Lifecycle (Master to Transaction Use)

- Master setup screens verified: `/categories`, `/brands`, `/units`, `/statuses`, `/conditions`, `/variations`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`.
- Product management screens verified: `/products` (listing) and `/products/create` (product creation form).
- Inventory and purchase modules exist as consuming workflows for product records: `/inventories/regular`, `/purchases/regular`, `/adjustments/regular`.

### 3. Purchasing Workflow

- Vendor master verified: `/vendors`.
- Purchase listing verified: `/purchases/regular`.
- Purchase creation verified: `/purchases/create/regular`.
- Demand communication screens verified: `/demands_send`, `/demands_send/create`, `/demands_response`.

### 4. Inventory Control Workflow

- Inventory view verified: `/inventories/regular`.
- Manual assignment management verified: `/inventory-assignements`, `/inventory-assignements/create`, `/employee-inventory-assignments`.
- Adjustment listing and creation verified: `/adjustments/regular`, `/adjustments/create/regular`.
- Audit trail entry point verified: `/audits`.

### 5. Access and Organization Workflow

- User administration verified: `/users`.
- Role administration verified: `/roles`, `/roles/create`.
- Store hierarchy verified: `/stores`.

## Page-by-Page Verified Details

### Dashboard

#### /

- Page title: Dashboard | Parwest Store Managment
- Table columns detected: `Sr#`, `From Store`, `To Store`, `Requested By`, `Date`, `Total Required Qty`, `Status`, `Actions`
- Forms detected: 3
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- In-page navigation targets: `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

### Administration

#### /roles

- Page title: Roles | Parwest Store Managment
- Table columns detected: `Sr#`, `Role Name`, `Action`
- Forms detected: 3
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- In-page navigation targets: `/roles`, `/`, `/users`, `/employee-inventory-assignments`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /roles/create

- Page title: Add Role | Parwest Store Managment
- Headings detected: `Role Permissions`
- Action controls detected: `Save`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`POST`, action=`/roles`, fields=`name*`, `selectAllPermissions`, `selectGroup1`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `selectGroup2`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `selectGroup3`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `permissions[]`, `selectGroup4`, `permissions[]`, `permissions[]`
- In-page navigation targets: `/roles/create`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`

#### /users

- Page title: users | Parwest Store Managment
- Table columns detected: `Sr#`, `Name`, `Email`, `Role`, `Stores/Wearhouse`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`name*`, `role_id`, `email*`, `password*`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`
- Form: method=`GET`, action=`(self)`, fields=`name*`, `role_id`, `email*`, `password`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`, `store_ids[]`
- In-page navigation targets: `/users`, `/`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

### Store Structure

#### /employee-inventory-assignments

- Page title: Employee Assignments | Parwest Store Management
- Table columns detected: `Sr#`, `Employee ID`, `Employee Name`, `Product`, `Assigned By`, `Assigned At`, `Assigning Condition`, `Revoked By`, `Revoked At`, `Revoking Condition`, `Remarks`, `Action`, `Product Name`, `Assign Date`
- Action controls detected: `Clear Filters`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`condition_id*`, `revoked_at*`
- Form: method=`GET`, action=`(self)`, fields=`guard_parwest_id*`, `assigned_at*`, `guardName`, `guardStatus`, `guardSupervisor`
- In-page navigation targets: `/employee-inventory-assignments`, `/`, `/users`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /stores

- Page title: Stores | Parwest Store Managment
- Table columns detected: `warehouse Name`, `Region Name`, `Prefix`, `Store`, `Landline`, `Mobile`, `Address`, `Edit`, `Delete`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`is_warehouse`, `region_name*`, `prefix*`, `head_office*`, `landline*`, `mobile*`, `address*`, `latitude*`, `longitude*`
- Form: method=`GET`, action=`(self)`, fields=`is_warehouse`, `region_name*`, `prefix*`, `head_office*`, `landline*`, `mobile*`, `address*`, `latitude*`, `longitude*`
- In-page navigation targets: `/stores`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

### Inventory Operations

#### /adjustments/create/regular

- Page title: Add Adjustment | Parwest Store Managment
- Table columns detected: `Product Name`, `Product Code`, `Calibre`, `Weapon Type`, `New Stock`, `Reusable Stock`, `Product Quantity`, `Condtion`, `Action`, `Total Qty`, `0`
- Action controls detected: `Add Adjustment Loading...`, `Delete`, `file.submit`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`POST`, action=`/adjustments/store`, fields=`store_id`, `product_code_name`, `note*`, `submit-button`
- In-page navigation targets: `/adjustments/create/regular`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`

#### /adjustments/regular

- Page title: Adjustments | Parwest Store Managment
- Table columns detected: `Sr#`, `Head Office`, `Total Qty`, `Items`, `User`, `Dated`, `Note`, `Action`, `Size`, `Color`, `Code`
- Action controls detected: `CLOSE`
- Forms detected: 3
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- In-page navigation targets: `/adjustments/regular`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`

#### /audits

- Page title: Audits | Parwest Store Managment
- Table columns detected: `Sr#`, `User`, `Model`, `Model ID`, `Event`, `URL`, `IP`, `User Agent`, `Date`, `Action`
- Action controls detected: `Clear`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`user_id`, `auditable_type`, `event`, `date_from`, `date_to`
- In-page navigation targets: `/audits`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`

#### /inventories/regular

- Page title: Inventories | Parwest Store Managment
- Table columns detected: `Sr#`, `Store`, `Product`, `Product Variant`, `Category`, `Total Qty`, `Available Qty`, `Assigned Qty`, `Reusable Qty`, `damaged Qty`, `condemned Qty`, `stolen Qty`
- Action controls detected: `Clear Filters`
- Forms detected: 3
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- In-page navigation targets: `/inventories/regular`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /inventory-assignements

- Page title: Assignement | Parwest Store Managment
- Table columns detected: `Sr#`, `Guard PPS ID`, `Guard Name`, `Branch Name`, `Product`, `Assigned By`, `Assigned At`, `Assigning Condition`, `Revoked By`, `Revoked At`, `Revoking Condition`, `Remarks`, `Action`
- Action controls detected: `Clear Filters`, `Revoke`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`condition_id*`, `revoked_at*`
- In-page navigation targets: `/inventory-assignements`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /inventory-assignements/create

- Page title: Add Assignement | Parwest Store Managment
- Table columns detected: `Product Name`, `Product Code`, `Product Quantity`, `Product Condition`, `Total Qty`, `0`, `Name`, `Assign Date`
- Action controls detected: `Assign Products`, `Close`, `Delete`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`POST`, action=`/inventory-assignements`, fields=`store_id`, `guard_parwest_id`, `assigned_at`, `guardName`, `guardStatus`, `guardSupervisor`, `guardBranch`, `guardBranchCode`, `product_code_name`, `remarks`
- In-page navigation targets: `/inventory-assignements/create`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

### Purchasing and Vendors

#### /demands_response

- Page title: Demands Responsed | Parwest Store Managment
- Table columns detected: `Sr#`, `From Store`, `To Warehouse`, `Status`, `Dated`, `Requested By`, `Responsed By`, `Canceled By`, `Canceled Reason`, `Canceled at`, `Rejected By`, `Rejected Reason`, `Rejected at`, `Total Quantity`, `Request Remarks`, `Response Remarks`, `Action`
- Action controls detected: `Submit`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`POST`, action=`/demand/response-demand/status/update/reject`, fields=`reject_reason*`
- In-page navigation targets: `/demands_response`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /demands_send

- Page title: Demands | Parwest Store Managment
- Table columns detected: `Sr#`, `From Store`, `To Warehouse`, `Status`, `Dated`, `Requested By`, `Responsed By`, `Canceled By`, `Canceled Reason`, `Canceled at`, `Rejected By`, `Rejected Reason`, `Rejected at`, `Total Quantity`, `Total Fulfill Qty`, `Request Remarks`, `Response Remarks`, `Action`, `Product`, `Code`
- Action controls detected: `Submit`, `Confirm Receive`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`POST`, action=`/demand/send-demand/cancel`, fields=`cancel_reason*`
- In-page navigation targets: `/demands_send`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /demands_send/create

- Page title: Add Demands | Parwest Store Managment
- Table columns detected: `Product Name`, `Product Code`, `Available New Stock`, `Available Reusable Stock`, `Required Quantity`, `Delete`, `Total Qty`, `0`
- Action controls detected: `Add Demands Loading...`, `Delete`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`POST`, action=`/demands_send`, fields=`from_store`, `to_store`, `product_code_name`, `request_remarks`
- In-page navigation targets: `/demands_send/create`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`

#### /purchases/create/regular

- Page title: Add Purchase | Parwest Store Managment
- Table columns detected: `Product Name`, `Product Code`, `Calibre`, `Weapon Type`, `New Stock`, `Reusable Stock`, `Product Quantity`, `Product Price`, `Action`, `Total price`, `0`, `Total Qty`
- Action controls detected: `Add Purchase Loading...`, `Delete`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`POST`, action=`/purchases/store`, fields=`store_id`, `vendor_id`, `attachments[]`, `date`, `product_code_name`, `note`, `approval_reference`, `invoice_number`, `invoice_date`, `delivery_challan_no`
- In-page navigation targets: `/purchases/create/regular`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /purchases/regular

- Page title: Purchase | Parwest Store Managment
- Table columns detected: `Sr#`, `Store/Warehouse`, `Vendor`, `User`, `Purchase Date`, `Total Invoice`, `Status`, `Confirmed/Rejected By`, `Confirmed/Rejected At`, `Reject Reason`, `Note`, `Action`
- Action controls detected: `Reject`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`POST`, action=`(self)`, fields=`reason*`
- In-page navigation targets: `/purchases/regular`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /vendors

- Page title: Vendors | Parwest Store Managment
- Table columns detected: `Sr#`, `Company Name`, `Company Phone`, `Contact Person Name`, `Contact Person Phone`, `Address`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`company_name*`, `company_phone*`, `contact_person_name*`, `contact_person_phone*`, `address*`
- Form: method=`GET`, action=`(self)`, fields=`company_name*`, `company_phone*`, `contact_person_name*`, `contact_person_phone*`, `address*`
- In-page navigation targets: `/vendors`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

### Product Master Data

#### /brands

- Page title: Brands | Parwest Store Managment
- Table columns detected: `Sr#`, `Name`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`name*`
- Form: method=`GET`, action=`(self)`, fields=`name*`
- In-page navigation targets: `/brands`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /calibres

- Page title: Calibres | Parwest Store Managment
- Table columns detected: `Sr#`, `Name`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`name*`
- Form: method=`GET`, action=`(self)`, fields=`name*`
- In-page navigation targets: `/calibres`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /categories

- Page title: Categories | Parwest Store Managment
- Table columns detected: `Sr#`, `Name`, `Parent Category`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`name*`, `assign_create[]`, `parent_id`
- Form: method=`GET`, action=`(self)`, fields=`name*`, `assign_update[]`, `parent_id`
- In-page navigation targets: `/categories`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /conditions

- Page title: Conditions | Parwest Store Managment
- Table columns detected: `Sr#`, `Name`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`name*`
- Form: method=`GET`, action=`(self)`, fields=`name*`
- In-page navigation targets: `/conditions`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/variations`, `/repairings`, `/audits`

#### /licenses

- Page title: licenses | Parwest Store Managment
- Table columns detected: `Sr#`, `Weapon Type`, `Calibre`, `License Number`, `Weapon Number`, `Issue Date`, `Expiry Date`, `Validity`, `Created By`, `Updated By`, `Created At`, `Updated At`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`validity`, `license_number*`, `client_id`, `weapon_number*`, `weapon_type_id`, `calibre_id`, `issue_date`, `expiry_date`, `attachment[]`
- Form: method=`GET`, action=`(self)`, fields=`validity`, `license_number*`, `client_id`, `weapon_type_id`, `calibre_id`, `attachment[]`
- In-page navigation targets: `/licenses`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /product-unique-items

- Page title: Weapon Unique Items | Parwest Store Managment
- Table columns detected: `Sr#`, `Product`, `Weapon Number`, `Unique Number`, `License`, `Created At`, `Action`
- Action controls detected: `Cancel`, `Update`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`weapon_number*`, `license_id*`
- In-page navigation targets: `/product-unique-items`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /products

- Page title: Products | Parwest Store Managment
- Table columns detected: `Sr#`, `Name`, `Category`, `Weapon Type`, `Calibre`, `Brand`, `Unit`, `Product Code`, `Action`, `Size`, `Color`, `Code`
- Action controls detected: `Add Variant`, `CLOSE`, `Save`
- Forms detected: 4
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`size`, `color`
- In-page navigation targets: `/products`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`

#### /products/create

- Page title: Add Product | Parwest Store Managment
- Action controls detected: `Add Product`, `Add`, `Close`, `➕ Add New`
- Forms detected: 6
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`POST`, action=`/products`, fields=`name*`, `code*`, `category_id*`, `weapon_type_id`, `calibre_id`, `brand_id*`, `unit_id*`, `sizes[]`, `colors[]`
- Form: method=`GET`, action=`(self)`, fields=`name*`, `assign_create[]`, `parent_id`
- Form: method=`GET`, action=`(self)`, fields=`name*`
- In-page navigation targets: `/products/create`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`

#### /repairings

- Page title: Repairinges | Parwest Store Managment
- Table columns detected: `Sr#`, `Store Name`, `Product Name`, `Product Variant`, `Product Code`, `PPS Number`, `Item Status`, `Repairing Status`, `Action`
- Action controls detected: `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`name*`
- Form: method=`GET`, action=`(self)`, fields=`name*`
- In-page navigation targets: `/repairings`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/audits`

#### /statuses

- Page title: Statuses | Parwest Store Managment
- Table columns detected: `Sr#`, `Name`, `Category`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`name*`, `category_id`
- Form: method=`GET`, action=`(self)`, fields=`name*`, `category_id`
- In-page navigation targets: `/statuses`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /units

- Page title: Units | Parwest Store Managment
- Table columns detected: `Sr#`, `Name`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`name*`
- Form: method=`GET`, action=`(self)`, fields=`name*`
- In-page navigation targets: `/units`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

#### /variations

- Page title: Variations | Parwest Store Managment
- Table columns detected: `Sr#`, `Category Name`, `Name`, `Type`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`category_id*`, `type*`, `name*`
- Form: method=`GET`, action=`(self)`, fields=`category_id*`, `type*`, `name*`
- In-page navigation targets: `/variations`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/weapon-types`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/repairings`, `/audits`

#### /weapon-types

- Page title: Weapon Types | Parwest Store Managment
- Table columns detected: `Sr#`, `Name`, `Action`
- Action controls detected: `Create New`, `Add`, `Close`, `Update`, `CLOSE`
- Forms detected: 5
- Form: method=`GET`, action=`(self)`, fields=`top-search`
- Form: method=`GET`, action=`(self)`, fields=`Search ...`
- Form: method=`POST`, action=`/logout`, fields=none
- Form: method=`GET`, action=`(self)`, fields=`name*`
- Form: method=`GET`, action=`(self)`, fields=`name*`
- In-page navigation targets: `/weapon-types`, `/`, `/users`, `/employee-inventory-assignments`, `/roles`, `/inventories/regular`, `/inventory-assignements`, `/inventory-assignements/create`, `/stores`, `/demands_send`, `/demands_response`, `/vendors`, `/purchases/regular`, `/purchases/create/regular`, `/calibres`, `/licenses`, `/product-unique-items`, `/brands`, `/units`, `/categories`, `/statuses`, `/conditions`, `/variations`, `/repairings`, `/audits`

## Verified Issues and Broken Links

- No authenticated 4xx/5xx routes were detected in filtered application links.

## Evidence Files

- Raw crawl JSON: `docs/staging-store-authenticated-crawl.json`
- Initial route probe snapshot: `docs/staging-route-probe-initial.txt`
- Deep route probe snapshot: `docs/staging-route-probe-deep.txt`
