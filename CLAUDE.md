# Parwest ERP

Next.js 14 App Router ERP for Parwest Security Services. PostgreSQL + Prisma, NextAuth.js (JWT), Tailwind CSS. Deployed to Vercel (sin1/Singapore).

## Commands

```bash
npm run dev              # Start dev server
next build               # Standard Next.js build
node scripts/vercel-build.mjs  # Production build (used by Vercel)
npm run lint             # ESLint
npx tsc --noEmit         # Type check

# Database
npx prisma generate      # Regenerate client after schema changes
npx prisma migrate dev   # Run migrations locally
npx prisma db push       # Push schema without migration (dev only)
npx prisma studio        # DB GUI
npm run db:migrate:deploy # Deploy migrations in production
```

## Architecture

```
src/
  app/
    (auth)/              # Login page
    (dashboard)/         # All protected routes
      guards/            # Guard management (18 profile tabs)
      clients/           # Client + branch management
      payroll/           # Salary, loans, extra hours
      store-inventory/   # Inventory v2 (active)
      inventory/         # Legacy inventory (deprecated)
      deployments/       # Guard deployments
      users/             # User + permissions management
      tickets/           # Issue tracking
      reports/           # Reporting
      settings/          # System config
      audit/             # Activity logs
    api/                 # Route handlers (Next.js API routes)
  lib/
    db.ts                # Prisma client singleton (supports mock mode)
    auth.ts              # Full NextAuth config (server only, Prisma adapter)
    runtime/             # Feature flags (mock mode)
  auth.config.ts         # Edge-compatible auth config (used by middleware only)
  middleware.ts          # JWT-based module permission enforcement
```

## Auth & Permissions

Two auth configs exist intentionally:
- `src/auth.config.ts` — edge-compatible (no Node.js imports), used by `middleware.ts` for JWT decoding
- `src/lib/auth.ts` — full config with PrismaAdapter, used for sign-in

Permission model: users have a `role` + `permissions[]` array in the JWT.
**SuperAdmin gotcha**: `role === "Super User"` = always unrestricted. `role === "Admin"` AND `permissions.length === 0` = unrestricted access. An Admin *with* permissions is a regional admin restricted to those modules.

Module → permission mapping is in `middleware.ts` `MODULE_ROUTES`.

## Mock Mode

Set `NEXT_PUBLIC_USE_MOCKS=true` (or `USE_MOCKS=true`) to use in-memory mock data instead of a real database. Useful for UI work without a DB connection. Mock client lives in `src/lib/mockData/prismaMock.ts`.

## Database

Prisma with `@prisma/adapter-pg` (uses `pg` Pool for connection pooling — not the default Prisma setup). Requires `DATABASE_URL` or `DATABASE_URL_UNPOOLED` env var. Schema: `prisma/schema.prisma`.

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection |
| `DATABASE_URL_UNPOOLED` | Unpooled Postgres (fallback) |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | JWT signing secret |
| `NEXT_PUBLIC_USE_MOCKS` | Enable mock DB mode |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` | OCR vision providers |
| `OCR_PROVIDER` | Force OCR provider: `gemini` / `openai` / `openrouter` (else auto-picks) |
| `OCR_DEBUG` | `true` logs raw OCR model responses |

## Key Gotchas

- **Build script**: `npm run build` runs `scripts/vercel-build.mjs`, not plain `next build`. Use `npm run build:next` for a raw Next.js build.
- **Inventory v2**: `store-inventory/` is the active inventory system. `inventory/` is the legacy system — do not add features there.
- **Prisma postinstall**: `prisma generate` runs automatically on `npm install`.
- **Lint budget**: `npm run lint:guard` checks lint count against a baseline in `docs/lint-baseline.json` — don't introduce new lint errors.
- **API envelope**: use helpers in `src/lib/api/response.ts` (`ok`, `badRequest`, `conflict`, `notFound`, `forbidden`, `unauthorized`, `internalServerError`). Error envelope is `{ success: false, message, code }` — clients read `data.message`, NOT `data.error`.
- **Regional scoping**: `src/lib/access/scope.ts` — use `deriveManagerScope(session)` + `buildManagerScopeWhere(scope, { regionId, regionalOfficeId })` on list queries; `managerScopeDenied(scope, { ... })` for mutation guards.
- **Workflow rules**: API validations are gated by `isWorkflowRuleEnabled("...")` from `src/lib/workflows/policy.ts` (e.g. `deployments.requireActiveGuardStatus`). Check that file before adding new validation.
- **OCR Autofill**: `src/app/api/ocr/extract/route.ts` — vision LLM with Gemini→OpenRouter→OpenAI provider fallback (90s timeouts, AbortController). Tesseract.js is client-side last resort in `src/components/ocr/ParwestAIAutofill.tsx`.
- **No hardcoded data fallbacks in forms**: if an API returns empty, show empty. Never fall back to a `LEGACY_*` constant array with fake IDs — this caused production eligibility bugs.
- **Store-inventory auth**: `src/lib/inventory/store-v2-api.ts::requireInventorySession()` is the shared auth+module guard for all v2 store-inventory routes — add checks there, not per-file.
- **Shared inventory validators**: `src/lib/inventory/store-v2-validators.ts` — exports `isWeaponCategoryName`, `normalizeCategoryScope`. Don't redefine locally in store-inventory routes.
- **Guard list select**: `api/guards` GET uses explicit `select` that excludes `photoUrl` (base64 blob). Don't add `photoUrl` to list queries — fetch on detail endpoint only.
- **Parwest ID generation**: uses `findFirst({ orderBy: { parwestId: "desc" } })` — do not revert to a findMany scan.
- **Pending DB indexes** (need `prisma migrate dev`): `Attendance(guardId,date)`, `Deployment(status,clientId)`, `Payroll(paymentStatus,month)`.
- **Deductions are canonical, entry-based** (May 2026). `PayrollDeductionEntry` is the single source of truth for every deduction line. Legacy `Payroll.cwf/eobi/essi/trainingSchoolFees/otherDeductions` floats are dropped. Per-code resolvers in `src/lib/deductions/resolvers.ts` are dispatched by `resolveDeductionsForPayroll` (in `src/lib/deductions/index.ts`), wired into `calculate.ts`. Rates live in effective-dated tables (`ApsaaBranchRate`, `CwfRegionRate`, `EobiRate`, `EssiRate`, `ApsaaPunjabRate`, `UniformPlan`, `UniformResignationTier`, `NightCallRule`) with propose/approve/supersede flow via `src/lib/deductions/rates.ts`. Trigger endpoints under `src/app/api/deductions/*` (uniform issuance, training fees, advance salary, night-call ingest); resignation hook lives in `src/lib/deductions/resignation.ts`. Per-line override at `PATCH /api/payroll/[id]/deductions/[typeId]/override` (gated by `PAYROLL.DEDUCTION_OVERRIDE` + workflow rule `deductions.allowOverrideOnFinalized`). Settings UI consolidated at `/settings/deductions`. Workflow rules: `deductions.*` keys in `src/lib/workflows/policy.ts`. Permissions: `DEDUCTIONS` module + extended actions (`RATE_PROPOSE`, `RATE_APPROVE`, `RATE_RETROACTIVE`, `POLICY_EDIT`) in `src/lib/constants/permissions.ts`.

## Shared source-of-truth helpers (2026-05 audit remediation) — reuse, don't reinvent

A cross-module audit + fix pass added canonical helpers. Route new code through these instead of hand-rolling. Full record: `docs/audits/*.md` + `docs/audits/REMEDIATION-CHECKLIST.md`.

- **Server authz/scope**: `isSuperAdmin` lives ONLY in `src/lib/api/permissions.ts` — never re-implement (a divergent copy once locked Super Users out of payroll-state actions). `requireGuardInScope(session, guardId)` (`src/lib/guards/access.ts`) guards every guard `[id]/*` mutation. Effective permissions = `resolveEffectivePermissions` (`src/lib/permissions/resolve.ts`), **UNION(role, user-override) per action**, used by BOTH `lib/auth.ts buildPermissionSet` and `api/user-permissions` GET.
- **Privilege escalation guards**: assigning a GLOBAL-scoped role requires `isSuperAdmin` server-side (POST `/api/users`, PATCH `/api/users/[id]`); no self-`roleId` change for non-SuperAdmin; `roles`/`role-permissions`/`user-permissions` GET+mutations are action-gated.
- **Guard create/edit/import**: `validateGuardPayload` (`src/lib/guards/validate-payload.ts`) + `cnicAvailability` (`cnic.ts`) + `resolveExServiceType` (`employmentType.ts`) are shared by POST/PUT/import. `Guard.cnic` is NO LONGER `@unique` — partial-unique; a terminated profile's CNIC is re-enrollable.
- **Guard status catalog (#58)**: `GuardStatusOption` (model + `/api/guard-status-options` CRUD, GUARDS-gated, mirrors the `guard-designation-types` template) is an **admin-managed reference/label catalog only** — it does NOT drive the canonical lifecycle (`lifecycleStatus` state machine / derived `Guard.status` shadow). Defaults seeded by the migration, not write-on-read. Badge-color palette is the shared SoT `src/lib/guards/statusColors.ts` (`GUARD_STATUS_COLORS` + `normalizeStatusColor`) — import it in both the route and UI; don't redefine. Managed in the Prerequisites page.
- **Client branches GET filter (#59)**: `GET /api/clients/[id]/branches` takes an optional `?regionalOfficeId=` (additive, applied AFTER `managerScopeDenied` so it only narrows within an authorized client). The deploy form passes the selected office to scope deployable branches; all other callers omit it (get all branches).
- **Clients are region-less (B1)**: branchful clients carry NO region/province — geo lives on their branches and they are scoped by branches via `clientScopeWhere(scope)`/`clientInScope(clientId, scope)` (SoT: `src/lib/clients/access.ts`); `Branch` now has a `regionalOffice` relation (Branch→regionalOffice→regionId). Only *branchless* clients keep their own `regionId`/`Region.province` (and the #47 province↔region guard applies to them). Guards still carry their own `regionId`.
- **Client home-province invariant (#47)**: a client's `operationalProvinces` (a single `Province` enum value, despite the plural name) MUST equal its home `Region.province` — "each province only lists its own cities" (KPK can't host the Lahore region). Enforced server-side by `checkRegionWithinProvince(db,{regionId,operationalProvince})` (`src/lib/geo/province.ts`, lenient when either side unset) in client POST + PUT; the CSV import DERIVES `operationalProvinces` from the region (like `city`, via `provinceForBranch`) so it can't drift. Province pickers everywhere use the shared **`PROVINCE_OPTIONS`** (enum values + labels) from `province-constants.ts` — NEVER hand-roll Title-case option lists (that caused only `KPK` to match `Region.province`). Display via `provinceLabel(value)`. New/edit client forms filter the Region dropdown to `region.province === selectedProvince` and reset region on province change; regional viewers' province is derived+locked from their pinned region. Backfill migration `20260602130000` normalized legacy values (applied to prod).
- **Guard lifecycle**: a guard with an active deployment cannot transition to a non-revoking status — enforced once in `applyTransition` (`ActiveDeploymentTransitionError`), inherited by every caller. Supervisor writes go through `assignGuardSupervisor` (`src/lib/guards/supervisorAssignment.ts`, terminal status `ENDED`) / client side `assignSupervisor` (`src/lib/clients/supervisorAssignment.ts`, `INACTIVE`).
- **Inventory stock**: `applyStockMovement` + `availableQty` (`src/lib/inventory/stock-movement.ts`) is the ONLY `StoreInventoryBalance` writer (atomic increments, quantity-weighted avg cost); availability = `onHand − held − issued`. Purchases cannot be created `RECEIVED` — stock enters only via the `[id]/receive` flow. Demand status = `demand-status-machine.ts` (mirrors the Prisma enum; the old `demand-status.ts` was deleted).
- **Payroll/deductions**: payment is **state-machine-only** — `state/mark-paid` is the sole `PAID` writer (sets `state`+`paymentStatus` in lock-step + stamps consumed deductions via `markDeductionsConsumed`); `salary/[id]` PATCH rejects `paymentStatus`. Loan create/edit/finalize/unfinalize must call `recalcAffectedMonths`. Manual `OTHER` deductions are written `isOverride=true` so recompute can't zero them.
- **Rate flows / deploy**: `DeploymentRate` (`/api/deployment-rates`, now gated) is the **guard-payroll** side; invoicing is `ClientContractRate` — never cross them (see memory `project_rate_flows`). Deploy guard-type vocab = `src/lib/constants/guardTypes.ts` (contract-independent; deployment precedes contract). The dead `PricingConfig` read + `InvoicePrerequisitesManager` were removed.
- **Client module (legacy-parity pass, 2026-05)**: client API routes share `checkClientScope(clientId, session)` (`src/lib/clients/access.ts`, returns `null | "not_found" | "forbidden"`) and `csvEscape` (`src/lib/csv.ts`) — don't re-inline. `safeAuditLog` now takes `targetEntityType/targetEntityId/targetRegionId/targetRegionalOfficeId`; client/branch/contract writers tag entities so GET `/api/clients/[id]/audit` (Client + this client's Branch rows + legacy description-contains fallback) can surface change history. Filter-faithful CSV exports: `/api/clients/[id]/{guards,extra-guards,branches}/export` driven by `<ClientExportButton>`.
- **Client billing integrity**: one current rate per `{contractId,province,city,guardType,exService}` is enforced by a **partial+COALESCE unique index** `ClientContractRate_current_combo_key` (raw SQL in `prisma/migrations/20260529120000_*`, NOT representable in schema.prisma — **applied to prod 2026-05-29** via `prisma migrate deploy`, 0 rows demoted). Read-only dup-check diagnostic: `scripts/inspect-dup-current-rates.mjs`. The rates POST **demotes the existing current row BEFORE creating the new one** (else the index trips mid-txn) and catches `P2002`→`conflict`. Rate dates must fall within the contract window; contract `endDate` must be ≥1 day after `startDate`.
- **Branch deactivation cascade**: `deactivateBranchWithCascade` (`src/lib/branches/deactivate.ts`) + POST `/api/branches/[id]/deactivate` ends active deployments (status INACTIVE + endDate/endReason), flags the un-deployed guards' still-`ASSIGNED` inventory (`expectedReturnAt` + note — inventory is guard-scoped, not branch-scoped; no PENDING_RETURN enum), flips branch INACTIVE, all in one txn; reason+effectiveDate are mandatory and live in the audit record + deployment fields. Inventory step gated by `branches.cascadeOnDeactivate`. The plain PATCH path still BLOCKS deactivation with active deployments (`branches.blockInactiveWithActiveDeployment`).
- **Contract billing modes (2026-05-30, branch `feat/scoped-contract-rates`).** `ClientContract.billingMode` = `MANUAL | DYNAMIC`. **MANUAL** = scoped standard rates: `ClientContractRate` keyed by explicit `scopeLevel BRANCH|REGION|PROVINCE|GLOBAL` (+ `scopeBranchId/scopeRegionId/scopeProvince`), resolved most-specific-wins by `selectManualScopedRate` (`src/lib/invoicing/rateSelection.ts`; sort = rateStartDate desc → isCurrentRate → id); one-current enforced by **four per-scope partial-unique indexes** `ClientContractRate_current_{branch,region,province,global}_key` (one per scopeLevel — deliberately NOT one COALESCE index, because casting the `Province` enum→text in an index expr isn't IMMUTABLE → PG 42P17); legacy `province`/`city` columns DROPPED. **DYNAMIC** = per-enrolled-guard rates in new `ContractGuardRate` (`@@unique[contractId,guardId]`), resolved by `selectGuardRate` (`src/lib/invoicing/guardRate.ts`); route `…/contracts/[contractId]/guard-rates`. `guardType`/`exService` are **decorative labels only** (never selection keys). Invoicing dispatches by `billingMode` in `resolveContractRateContext` (`src/lib/invoicing/rates.ts`) — both `buildLines.ts` and `invoices/auto-fill` callers; bills `days × rate` monthly. **Province** is an enum on the `Region` entity (`provinceForBranch` in `src/lib/geo/province.ts`; client-safe `PROVINCE_VALUES` in `src/lib/geo/province-constants.ts` — never import `@/lib/geo/province` into a client component, it pulls `@prisma/client`). `Branch` has NO `regionId` — derive region via `regionalOfficeId → regionalOffice.regionId → client.regionId`. Spec/plan: `docs/superpowers/{specs,plans}/2026-05-*`. **Migration state:** `20260530120000_province_tier` + `…121000_contract_billing_mode_and_scope` (incl. data-migrate → 4 BRANCH/2 REGION/1 GLOBAL rows, 0 NULL) **APPLIED to prod 2026-05-30**; `…122000_contract_rate_scope_constraints` (CHECK + per-scope index swap + **DROP `province`/`city`** + defensive demotion) applies automatically on the next deploy — **`scripts/vercel-build.mjs` runs `prisma migrate deploy` as part of every Vercel build**, so migrations + code ship atomically (you do NOT apply prod migrations by hand; a broken migration fails the build). Read-only state check: `scripts/inspect-migration-state.mjs`; dry-run a migration safely with a BEGIN/ROLLBACK harness like `scripts/validate-122000.mjs`. Gotchas fixed live: (1) Postgres `UPDATE…FROM` can't reference the target table in a JOIN ON (use comma-join + WHERE) — 121000; (2) enum→text cast is not IMMUTABLE so it can't go in an index expr — use per-scope partial indexes — 122000.
- **Workflow-rules**: `RULE_DESCRIPTIONS` in `WorkflowRulesManager.tsx` is now an exhaustive `Record<WorkflowRuleKey,string>` (a new key fails compilation until documented).
- **Deferred Prisma migrations** (code refs already removed; drop pending prod-data check): `Inventory*`, `PayrollDefault`, `PricingConfig` models; `@@unique` on issuance tables; drop `UNPAID` from `PAYROLL_UNPAID_SALARY_STATUSES`; move workflow-rules + fingerprint config off flat-file → DB.
- **Tests**: `npm run test:integration` (Node, hits `localhost:3000`, mock-mode capable but partly stale) + Playwright `e2e/` (needs DB + browser). `npm run ci:quality` = lint:json + lint:guard + tsc (the static gate).

## Design System v1.1

The codebase migrated to shadcn/ui + Parwest token theme in 2026-04. Core conventions:

- **shadcn primitives** live at `@/components/shadcn/*`. Always prefer these over rolling custom UI.
- **Tokens** in `src/styles/tokens.css` (v1.0) + `src/styles/tokens-v1.1.css` (v1.1 contract + RTL + dark + reduced-motion). Tailwind v4 `@theme` keys in `src/styles/parwest-theme.css`.
- **No hex literals outside `src/styles/`** — use Tailwind utilities (`bg-primary`, `text-muted-foreground`) or v1.0 tokens (`var(--brand-600)`).
- **Forms**: react-hook-form + zod, schemas in `src/lib/schemas/*`. Wrap with shadcn `Form`. Field shape: `FormField → FormItem → FormLabel → FormControl → FormMessage`.
- **Currency**: use `<ParwestCurrency value={n}>` from `@/components/shadcn/parwest-currency`. Helpers `formatPKRShort`/`formatPKRFull` in `@/lib/format/currency`.
- **Toasts**: `import { toast } from 'sonner'`. Always read `data.message` from the API envelope, not `data.error`.
- **Region picker**: global in topbar (`AppTopbar` reads `useRegions()`, drives `?regionId=`). Don't add inline pickers per page.
- **Permission gates**: `<PermissionGate module="GUARDS" action="UPDATE" mode="disable">` from `@/components/shadcn/permission-gate`. Use `useCanAccess()` for imperative checks.
- **Sidebar always dark** — never inherits content theme. Token block in `tokens-v1.1.css`.
- **Destructive confirms** use shadcn `AlertDialog` with destructive Button variant. Browser `confirm()` is banned.
- **Status badges always include label text** — color is never the sole signal (a11y rule).
- **Add new components to `@/components/shadcn/`**, not `@/components/ui/`. The `ui/` folder contains legacy components retained for callers; do not extend.
- **Install shadcn primitives** via `npx shadcn@latest add <component> --legacy-peer-deps`.
