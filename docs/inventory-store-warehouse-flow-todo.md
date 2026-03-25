# Inventory Store/Warehouse Flow TODO

Last updated: 2026-03-25

- [x] Define strict store type semantics for Inventory V2 (`STORE` vs `WAREHOUSE`).
- [x] Enforce normalized store type values in store master create/update handlers.
- [x] Update Store master UI to use explicit toggle for Store vs Warehouse creation.
- [x] Enforce demand business rule in API: only `STORE -> WAREHOUSE`.
- [x] Update Demand UI dropdown behavior:
  - [x] "From Store" shows only Store records.
  - [x] "To Warehouse" shows only Warehouse records.
  - [x] Make both fields required for demand creation.
- [ ] Run smoke verification:
  - [x] Create Store via toggle.
  - [x] Create Warehouse via toggle.
  - [x] Demand from Store to Warehouse succeeds.
  - [x] Demand from Warehouse to Store fails with 400.
  - [x] Demand from Store to Store fails with 400.
  - [x] Demand from Warehouse to Warehouse fails with 400.

Evidence (2026-03-25):
- Local authenticated API smoke run against `http://localhost:3000`:
  - `PASS | Store to Warehouse | expected 201 got 201`
  - `PASS | Warehouse to Store | expected 400 got 400 | Demand flow must be Store -> Warehouse.`
  - `PASS | Store to Store | expected 400 got 400 | Demand flow must be Store -> Warehouse.`
  - `PASS | Warehouse to Warehouse | expected 400 got 400 | Demand flow must be Store -> Warehouse.`
- Store typing and demand flow are enforced in code:
  - `src/components/store-inventory-v2/MasterManager.tsx` (Store/Warehouse toggle UI)
  - `src/app/api/store-inventory/v2/masters/[resource]/route.ts` (store `type` validation)
  - `src/app/api/store-inventory/v2/demands/route.ts` (Store -> Warehouse rule)

Assignment separation update (2026-03-25):
- [x] Added independent assignment target types for inventory v2: `GUARD`, `EMPLOYEE`, `CLIENT`.
- [x] Added dedicated client assignment module route: `/store-inventory/client-assignments`.
- [x] Kept assignment flows separate by target type in API and UI.
- Evidence:
  - `prisma/schema.prisma` (`StoreInventoryAssignmentTargetType`, assignee target fields on `StoreInventoryAssignment`)
  - `src/app/api/store-inventory/v2/assignments/route.ts`
  - `src/components/store-inventory-v2/AssignmentsManager.tsx`
  - `src/app/(dashboard)/store-inventory/[screen]/page.tsx`
  - `src/components/sidebar.tsx`

Staging-form parity update (2026-03-25):
- [x] Updated Guard assignment form fields to match staging flow:
  - `Select Store`, `Search Guard`, `Assigned At`, `Guard Name`, `Guard Status`, `Guard Supervisor`, `Branch`, `Branch Code`, product lines, `Remarks`.
- [x] Updated Employee assignment form fields to match staging flow:
  - `Select Store`, `Select Employee`, `Assigned At`, `Employee Name`, `Employee Parwest ID`, `Designation`, `Region`, product lines, `Remarks`.
- [x] Updated Client assignment form fields to match staging flow:
  - `Select Store`, `Select Client`, `Select Branch`, `Assigned At`, `Manager/Supervisor`, `Active Deployment`, product lines, `Remarks`.
- [x] Added assignment API support for form date/remarks payload (`assignedAt`, `remarks`).
- [x] Added staging-style product table detail fields in assignment forms:
  - `Product Name`, `Product Code`, `Product Quantity`, `Product Condition`
  - `Calibre` and `Weapon Type` shown in client assignment rows.
- [x] Added `Remarks` column to assignment listing table.
- Evidence:
  - `src/components/store-inventory-v2/AssignmentsManager.tsx`
  - `src/app/api/store-inventory/v2/assignments/route.ts`
