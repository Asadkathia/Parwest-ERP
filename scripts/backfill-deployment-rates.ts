// Run with:
//   npx tsx scripts/backfill-deployment-rates.ts [--dry-run] [--default-rate <PKR>]
//
// Backfills Deployment.salary for pre-existing rows where BOTH salary AND rate
// are null. Resolution order per deployment:
//   1. Guard.salary (if set and > 0)
//   2. --default-rate (if provided)
//
// Idempotent — only touches rows where (salary IS NULL AND rate IS NULL).
// Without --default-rate, deployments whose guard has no salary set are
// skipped and logged for manual review.
//
// Commits in transactional batches of 100 to avoid long-held locks.

import "dotenv/config"
import { prisma } from "../src/lib/db"

const DRY_RUN = process.argv.includes("--dry-run")
const BATCH_SIZE = 100

function parseDefaultRate(): number | null {
  const idx = process.argv.indexOf("--default-rate")
  if (idx === -1) return null
  const raw = process.argv[idx + 1]
  if (!raw) {
    console.error("--default-rate requires a numeric value (e.g. --default-rate 1500)")
    process.exit(1)
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`--default-rate must be a positive number; got "${raw}"`)
    process.exit(1)
  }
  return n
}

const DEFAULT_RATE = parseDefaultRate()

type Candidate = {
  id: string
  guardId: string
  guard: {
    id: string
    parwestId: string | null
    name: string
    salary: number | null
  }
}

async function main() {
  console.log(
    `[backfill-deployment-rates] starting${DRY_RUN ? " (DRY RUN — no writes)" : ""}` +
      (DEFAULT_RATE != null ? ` (default-rate=${DEFAULT_RATE})` : "")
  )

  const candidates = (await prisma.deployment.findMany({
    where: { salary: null, rate: null },
    select: {
      id: true,
      guardId: true,
      guard: {
        select: { id: true, parwestId: true, name: true, salary: true },
      },
    },
  })) as Candidate[]

  console.log(
    `[backfill-deployment-rates] found ${candidates.length} deployment(s) with null salary AND null rate`
  )

  const toUpdate: Array<{ id: string; salary: number; source: "guard" | "default" }> = []
  const skipped: Array<{ id: string; parwestId: string | null; name: string; reason: string }> = []

  for (const dep of candidates) {
    const guardSalary = dep.guard?.salary
    if (guardSalary != null && Number.isFinite(guardSalary) && guardSalary > 0) {
      toUpdate.push({ id: dep.id, salary: guardSalary, source: "guard" })
      continue
    }
    if (DEFAULT_RATE != null) {
      toUpdate.push({ id: dep.id, salary: DEFAULT_RATE, source: "default" })
      continue
    }
    skipped.push({
      id: dep.id,
      parwestId: dep.guard?.parwestId ?? null,
      name: dep.guard?.name ?? "(unknown guard)",
      reason: guardSalary == null ? "Guard.salary is null" : `Guard.salary is ${guardSalary}`,
    })
  }

  for (const s of skipped) {
    console.warn(
      `[skip] deployment=${s.id} guard=${s.parwestId ?? "(no parwestId)"} "${s.name}" — ${s.reason}` +
        (DEFAULT_RATE == null ? " (pass --default-rate <PKR> to apply a fallback)" : "")
    )
  }

  const fromGuard = toUpdate.filter((u) => u.source === "guard").length
  const fromDefault = toUpdate.filter((u) => u.source === "default").length

  if (DRY_RUN) {
    console.log(
      `[backfill-deployment-rates] DRY RUN summary: would update ${toUpdate.length} (guard=${fromGuard}, default=${fromDefault}), skipped ${skipped.length}`
    )
    return
  }

  let updated = 0
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE)
    await prisma.$transaction(
      batch.map((row) =>
        prisma.deployment.update({
          where: { id: row.id },
          data: { salary: row.salary },
        })
      )
    )
    updated += batch.length
    console.log(`[backfill-deployment-rates] committed ${updated}/${toUpdate.length}`)
  }

  console.log(
    `[backfill-deployment-rates] done — updated=${updated} (guard=${fromGuard}, default=${fromDefault}), skipped=${skipped.length}, total-candidates=${candidates.length}`
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
