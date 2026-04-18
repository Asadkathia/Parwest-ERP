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

## Key Gotchas

- **Build script**: `npm run build` runs `scripts/vercel-build.mjs`, not plain `next build`. Use `npm run build:next` for a raw Next.js build.
- **Inventory v2**: `store-inventory/` is the active inventory system. `inventory/` is the legacy system — do not add features there.
- **Prisma postinstall**: `prisma generate` runs automatically on `npm install`.
- **Lint budget**: `npm run lint:guard` checks lint count against a baseline in `docs/lint-baseline.json` — don't introduce new lint errors.
