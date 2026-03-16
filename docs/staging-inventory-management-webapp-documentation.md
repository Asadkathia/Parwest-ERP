# Staging Inventory Management Webapp Documentation

- Environment: `https://staging-store.parwestgroup.com`
- Audit date: 2026-03-16
- Auditor: Codex (automated HTTP exploration)

## 1. Scope and Access Status

This document is intended to cover every screen, feature, and module of the staging inventory management webapp.

During the audit, authentication with the provided credentials failed:

- Email used: `admin@parwestgroup.com`
- Password used: `admin123@.`
- System response: `These credentials do not match our records.`

Because authenticated access was not available, screen-level documentation is split into:

- Verified (directly observed): public/login flow and HTTP route behavior
- Inferred (high confidence): authenticated modules and screen patterns based on protected route detection

## 2. Methodology

1. Loaded public pages directly (`/`, `/login`, known endpoints).
2. Attempted form-based login using Laravel CSRF token + session cookies.
3. Verified login rejection message on redirected login page.
4. Probed module routes and sub-routes.
5. Classified endpoints:
- `302 -> /login`: route likely exists and is protected by auth
- `404`: route likely not defined

## 3. Verified Screens and Behavior

## 3.1 Login Screen

- URL: `/login` (also served when visiting `/` unauthenticated)
- Title: `Laravel`
- Primary purpose: user authentication into inventory/store system

### Fields and Controls

- `email` (type `email`, required)
- `password` (type `password`, required)
- `remember` checkbox
- `Login` submit button
- `Forgot Your Password?` link (`/password/reset`)

### Validation and Error Handling

- Invalid credential attempt displays:
- `These credentials do not match our records.`
- Email input gets invalid styling class (`is-invalid`).

### UX Notes

- Centered card layout with gradient background.
- Classic Laravel auth pattern.
- Form posts to `/login` with `_token` CSRF field.

## 3.2 Password Reset Entry

- Link present on login UI: `/password/reset`
- Current direct response in this environment: `404 Not Found`
- Interpretation: feature may be disabled/misrouted in staging or protected by different routing setup.

## 4. Confirmed Module Surface (Route-Level)

The following modules returned `302 -> /login` and are therefore likely implemented as authenticated modules.

## 4.1 Inventory Master Data

### Products Module

- Base route: `/products`
- Confirmed protected sub-routes:
- `/products/create`
- `/products/index`
- `/products/list`
- `/products/new`
- `/products/add`
- `/products/manage`
- `/products/{id}`
- `/products/{id}/edit`
- `/products/import`
- `/products/export`
- `/products/report`

### Categories Module

- Base route: `/categories`
- Confirmed protected sub-routes include create/list/show/edit/import/export/report variants.

### Brands Module

- Base route: `/brands`
- Confirmed protected sub-routes include create/list/show/edit/import/export/report variants.

### Units Module

- Base route: `/units`
- Confirmed protected sub-routes include create/list/show/edit/import/export/report variants.

## 4.2 Inventory Transactions

### Adjustments Module

- Base route: `/adjustments`
- Confirmed protected sub-routes:
- `/adjustments/create`
- `/adjustments/index`
- `/adjustments/list`
- `/adjustments/new`
- `/adjustments/add`
- `/adjustments/manage`
- `/adjustments/{id}`
- `/adjustments/import`
- `/adjustments/export`
- `/adjustments/report`

Note:
- `/adjustments/1/edit` returned `404` during probe; edit path may be disabled, named differently, or guarded by stricter constraints.

### Purchases Module

- Base route: `/purchases`
- Confirmed protected sub-routes:
- `/purchases/create`
- `/purchases/index`
- `/purchases/list`
- `/purchases/new`
- `/purchases/add`
- `/purchases/manage`
- `/purchases/{id}`
- `/purchases/import`
- `/purchases/export`
- `/purchases/report`

Note:
- `/purchases/1/edit` returned `404`; edit URL may differ or editing may be restricted.

### Vendors Module

- Base route: `/vendors`
- Confirmed protected sub-routes include create/list/show/edit/import/export/report variants.

## 4.3 Administration and Security

### Users Module

- Base route: `/users`
- Confirmed protected sub-routes include create/list/show/edit/import/export/report variants.

### Roles Module

- Base route: `/roles`
- Confirmed protected sub-routes include create/list/show/edit/import/export/report variants.

## 4.4 Multi-Store / Location Layer

### Stores Module

- Base route: `/stores`
- Confirmed protected sub-routes include create/list/show/edit/import/export/report variants.

## 5. Feature Catalog (Inferred from Route Structure)

Given repeated route patterns across modules, the system likely supports the following standard capabilities:

- Listing records (`/index`, `/list`, `/manage`)
- Creating records (`/create`, `/new`, `/add`)
- Viewing details (`/{id}`)
- Editing records (`/{id}/edit`) where supported
- Bulk data ingestion (`/import`)
- Data extraction (`/export`)
- Module reporting (`/report`)

## 6. Routes Probed but Not Found (404)

These were checked and returned `404`, suggesting absent or differently named modules:

- `/inventory`, `/stocks`, `/warehouses`, `/transfers`, `/orders`, `/sales`, `/reports`, `/dashboard`, `/admin`, `/settings`, `/customers`, `/returns`, `/pos`, `/barcode`, `/audit-log` (and many related variants).

This indicates the app may be narrower than a full ERP and focused on store-centric inventory + purchasing + user-role management.

## 7. Module-by-Module Screen Matrix

Legend:
- Verified Route: route returns `302 -> /login` (exists, auth-gated)
- Inferred Screen: UI screen likely exists behind route

### Products

- Verified routes: index/list/manage/create/new/add/show/edit/import/export/report
- Inferred screens:
- Product list/grid
- Product create form
- Product detail view
- Product edit form
- Product import wizard/upload
- Product export action/view
- Product report view

### Categories

- Verified routes: index/list/manage/create/new/add/show/edit/import/export/report
- Inferred screens: category list/create/detail/edit/import/export/report

### Brands

- Verified routes: index/list/manage/create/new/add/show/edit/import/export/report
- Inferred screens: brand list/create/detail/edit/import/export/report

### Units

- Verified routes: index/list/manage/create/new/add/show/edit/import/export/report
- Inferred screens: unit list/create/detail/edit/import/export/report

### Adjustments

- Verified routes: index/list/manage/create/new/add/show/import/export/report
- Route exception: `/{id}/edit` not confirmed
- Inferred screens: adjustment list/create/detail/import/export/report

### Purchases

- Verified routes: index/list/manage/create/new/add/show/import/export/report
- Route exception: `/{id}/edit` not confirmed
- Inferred screens: purchase list/create/detail/import/export/report

### Vendors

- Verified routes: index/list/manage/create/new/add/show/edit/import/export/report
- Inferred screens: vendor list/create/detail/edit/import/export/report

### Users

- Verified routes: index/list/manage/create/new/add/show/edit/import/export/report
- Inferred screens: user list/create/detail/edit/import/export/report

### Roles

- Verified routes: index/list/manage/create/new/add/show/edit/import/export/report
- Inferred screens: role list/create/detail/edit/import/export/report

### Stores

- Verified routes: index/list/manage/create/new/add/show/edit/import/export/report
- Inferred screens: store list/create/detail/edit/import/export/report

## 8. Known Risks / Documentation Gaps

Because auth access is blocked, this document cannot yet verify:

- Actual UI layouts and field-level forms for authenticated modules
- Workflow-level behavior (create/update/delete lifecycles)
- Validation rules, business constraints, and error messages per module
- Permission matrix behavior by role
- Report contents and export formats
- Actual menu hierarchy and dashboard widgets

## 9. Recommended Next Audit Pass (After Valid Credentials)

When working credentials are available, perform full authenticated walkthrough and extend this same file with:

- Every menu item and submenu
- Every page screenshot reference
- Every form field catalog (required/optional/default)
- Every action button + side effects
- Every filter/search/sort/pagination behavior
- Role-wise access table (admin/manager/clerk, etc.)
- End-to-end module workflows (e.g., vendor -> purchase -> stock effect -> adjustment)

## 10. Raw Route Discovery Snapshot

Confirmed protected roots:

- `/products`
- `/categories`
- `/brands`
- `/units`
- `/adjustments`
- `/purchases`
- `/vendors`
- `/users`
- `/roles`
- `/stores`

Authentication test result:

- Login attempt redirects back to `/login` with credential mismatch validation.

