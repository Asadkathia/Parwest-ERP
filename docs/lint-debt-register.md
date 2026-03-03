# Lint Debt Register

Last updated: 2026-03-01
Source command: `npm run lint -- --format json --output-file /tmp/eslint-report.json`

## Baseline Summary

- Total lint findings: `292`
- Errors: `263`
- Warnings: `29`
- Files scanned: `365`
- Files with issues: `155`
- Auto-fixable: `0` errors, `0` warnings

## Ownership Split

| Owner | Errors | Warnings | Total |
|---|---:|---:|---:|
| `@backend` | 148 | 8 | 156 |
| `@frontend` | 114 | 20 | 134 |
| `@platform` | 0 | 1 | 1 |
| `@shared` | 1 | 0 | 1 |

## Module Breakdown (Top First)

| Module bucket | Total | Errors | Warnings | Files with issues | Primary owner |
|---|---:|---:|---:|---:|---|
| `api` | 138 | 136 | 2 | 71 | `@backend` |
| `guards-ui` | 35 | 31 | 4 | 15 | `@frontend` |
| `guards-components` | 29 | 25 | 4 | 21 | `@frontend` |
| `payroll-components` | 16 | 13 | 3 | 8 | `@frontend` |
| `inventory-components` | 15 | 15 | 0 | 8 | `@frontend` |
| `clients-ui` | 14 | 11 | 3 | 6 | `@frontend` |
| `lib` | 13 | 11 | 2 | 3 | `@backend` |
| `components-other` | 11 | 7 | 4 | 7 | `@frontend` |
| `clients-components` | 6 | 5 | 1 | 4 | `@frontend` |
| `prisma` | 3 | 1 | 2 | 1 | `@backend` |

## Top Rule Hotspots

| Rule | Count | Priority | Owner |
|---|---:|---|---|
| `@typescript-eslint/no-explicit-any` | 233 | P0 | `@backend` + `@frontend` |
| `react/no-unescaped-entities` | 17 | P1 | `@frontend` |
| `@typescript-eslint/no-unused-vars` | 13 | P1 | mixed |
| `react-hooks/exhaustive-deps` | 11 | P1 | `@frontend` |
| `react-hooks/set-state-in-effect` | 7 | P1 | `@frontend` |
| `@next/next/no-img-element` | 3 | P2 | `@frontend` |
| `@next/next/no-assign-module-variable` | 3 | P2 | `@backend` |

## Top Individual Files

| Findings | Errors | Warnings | File |
|---:|---:|---:|---|
| 11 | 9 | 2 | `src/lib/mockData/prismaMock.ts` |
| 7 | 7 | 0 | `src/app/api/guards/search/route.ts` |
| 6 | 6 | 0 | `src/app/(dashboard)/guards/[id]/page.tsx` |
| 6 | 6 | 0 | `src/app/api/guards/route.ts` |
| 6 | 4 | 2 | `src/components/guards/tabs/GeneralInformationTab.tsx` |
| 5 | 5 | 0 | `src/app/(dashboard)/guards/deploy/form.tsx` |

## Burn-down Plan

1. P0 (`@typescript-eslint/no-explicit-any`) in `src/app/api/*` and high-churn UI files.
2. P1 React correctness rules in Guards + Clients UI/components.
3. P2 framework rules (`no-img-element`, module variable assignment).
4. Re-baseline after each 50-finding reduction.

## Exit Criteria for Lint Gate

1. `npm run lint` reaches `0` errors.
2. Warnings reduced to agreed threshold (target `<=10`) or explicitly waived.
3. New PR policy: no net-new lint findings.

## Suggested Work Packages

1. `ERP-LINT-002` (`@backend`): Remove `any` in `src/app/api/*` batch 1.
2. `ERP-LINT-003` (`@frontend`): Guards UI/components hooks and `any` cleanup.
3. `ERP-LINT-004` (`@frontend`): Clients/Payroll/Inventory component cleanup.
4. `ERP-LINT-005` (`@platform`): enforce no net-new lint findings in CI.

## ERP-LINT-003 Output: Module Execution Batches

The following execution batches are now the canonical lint burn-down plan. Each batch is independently mergeable and evidence-driven.

### Batch Matrix

| Batch ID | Status | Owner | Scope | Target finding reduction | Acceptance criteria |
|---|---|---|---|---:|---|
| `LINT-B01` | `todo` | `@backend` | `src/app/api/**` (`any` + unused vars) | `>= 40` | `npm run lint -- src/app/api` shows net reduction and no new rule categories introduced |
| `LINT-B02` | `todo` | `@frontend` | `src/app/(dashboard)/guards/**` + `src/components/guards/**` | `>= 35` | guards UI bucket reduced; hooks dependency warnings reduced without behavior regression |
| `LINT-B03` | `todo` | `@frontend` | `src/components/payroll/**` + `src/app/(dashboard)/payroll/**` | `>= 25` | payroll components eliminate top `any`/hooks warnings for touched files |
| `LINT-B04` | `todo` | `@frontend` | `src/components/inventory/**` + `src/app/(dashboard)/inventory/**` | `>= 20` | inventory UI lint debt reduced with no new runtime warnings |
| `LINT-B05` | `todo` | `@frontend` | `src/components/clients/**` + `src/app/(dashboard)/clients/**` | `>= 20` | clients UI lint debt reduced and main tab screens remain functional |
| `LINT-B06` | `todo` | `@platform` | repo-level framework rules + CI guardrail | gate task | CI blocks net-new findings; lint JSON artifact archived per run |

### Per-Batch Evidence Template

For each batch completion, capture:

1. Commands
   - `npm run lint -- --format json --output-file /tmp/eslint-report-<batch>.json`
   - `npm run lint -- <batch scope>`
2. Delta
   - before/after total findings
   - before/after bucket findings for touched scope
3. Files touched list
4. Regression check
   - `npx tsc --noEmit`
   - `set -a; source .env; set +a; npm run build`

### Execution Order (Locked)

1. `LINT-B01` (API)
2. `LINT-B02` (Guards)
3. `LINT-B03` (Payroll)
4. `LINT-B04` (Inventory)
5. `LINT-B05` (Clients)
6. `LINT-B06` (CI / no-net-new policy)
