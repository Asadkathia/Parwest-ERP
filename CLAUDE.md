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
**SuperAdmin gotcha**: `role === "Admin"` AND `permissions.length === 0` = unrestricted access. An Admin *with* permissions is a regional admin restricted to those modules.

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
