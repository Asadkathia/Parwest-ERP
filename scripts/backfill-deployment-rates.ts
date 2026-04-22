// Run with: npx tsx scripts/backfill-deployment-rates.ts [--dry-run]
//
// Backfills Deployment.salary for pre-existing rows where BOTH salary AND rate
// are null. Uses the guard's primary Guard.salary as the per-day rate.
//
// Idempotent — only touches rows where (salary IS NULL AND rate IS NULL).
// Skips deployments whose guard has no salary set (null or zero) and logs
// them so they can be manually rated.
//
// Commits in transactional batches of 100 to avoid long-held locks.

import "dotenv/config"
import { prisma } from "../src/lib/db"

const DRY_RUN = process.argv.includes("--dry-run")
const BATCH_SIZE = 100

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
  console.log(`[backfill-deployment-rates] starting${DRY_RUN ? " (DRY RUN — no writes)" : ""}`)

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

  console.log(`[backfill-deployment-rates] found ${candidates.length} deployment(s) with null salary AND null rate`)

  const toUpdate: Array<{ id: string; salary: number }> = []
  const skipped: Array<{ id: string; parwestId: string | null; name: string; reason: string }> = []

  for (const dep of candidates) {
    const guardSalary = dep.guard?.salary
    if (guardSalary == null || !Number.isFinite(guardSalary) || guardSalary <= 0) {
      skipped.push({
        id: dep.id,
        parwestId: dep.guard?.parwestId ?? null,
        name: dep.guard?.name ?? "(unknown guard)",
        reason: guardSalary == null ? "Guard.salary is null" : `Guard.salary is ${guardSalary}`,
      })
      continue
    }
    toUpdate.push({ id: dep.id, salary: guardSalary })
  }

  for (const s of skipped) {
    console.warn(
      `[skip] deployment=${s.id} guard=${s.parwestId ?? "(no parwestId)"} "${s.name}" — ${s.reason}`
    )
  }

  if (DRY_RUN) {
    console.log(`[backfill-deployment-rates] DRY RUN summary: would update ${toUpdate.length}, skipped ${skipped.length}`)
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
    `[backfill-deployment-rates] done — updated=${updated}, skipped=${skipped.length}, total-candidates=${candidates.length}`
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
