# Legacy vs Current ERP Replication Report

## Coverage Snapshot
- Legacy routes discovered from staging menu: **104**
- Mapped and currently replicated routes: **104**
- Overall route-level replication: **100.0%**
- Replication for mapped legacy endpoints only: **104/104 (100.0%)**

## Module Breakdown
- Audit: 1/1 (100.0%)
- Imports: 15/15 (100.0%)
- Clients: 9/9 (100.0%)
- Guards: 37/37 (100.0%)
- Inventory: 10/10 (100.0%)
- Dashboard: 1/1 (100.0%)
- Settings/System: 2/2 (100.0%)
- Reports: 15/15 (100.0%)
- Payroll: 2/2 (100.0%)
- Ticketing: 1/1 (100.0%)
- Users & Access: 11/11 (100.0%)

## Major Gaps To Reach Exact Legacy Parity

## Full Unmatched List

## Notes
- This comparison is based on live staging crawl + current Next.js route structure.
- Dynamic route handlers (/payroll/operations/[screen], /inventory/[screen], /reports/[screen]) are counted as replicated when mapped subpaths exist.
- Exact workflow parity still requires manual UAT for create/edit/approve/export/import actions and modal behavior.
- Artifacts: `artifacts/legacy-audit/legacy-audit.json`, `artifacts/legacy-audit/legacy-routes.csv`, `docs/legacy-vs-current-route-parity.csv`, `docs/legacy-erp-page-catalog.md`.
