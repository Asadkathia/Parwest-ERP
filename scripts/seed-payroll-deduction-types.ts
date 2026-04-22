// Run with: npx tsx scripts/seed-payroll-deduction-types.ts
// AFTER applying the payroll_rework_phase1 migration.
//
// Idempotent — uses upsert by `code`. Existing rows are NOT overwritten so
// admin-tuned defaultAmount / sortOrder / isActive values survive re-runs.

import { prisma } from "../src/lib/db"

type Seed = {
  code: string
  name: string
  defaultAmount: number
  sortOrder: number
}

const seeds: Seed[] = [
  { code: "TRAINING_FEE", name: "Training School Fee", defaultAmount: 0, sortOrder: 10 },
  { code: "CWF", name: "Contribution Welfare Fund", defaultAmount: 0, sortOrder: 20 },
  { code: "EOBI", name: "EOBI", defaultAmount: 0, sortOrder: 30 },
  { code: "ESSI", name: "ESSI", defaultAmount: 0, sortOrder: 40 },
]

async function main() {
  for (const seed of seeds) {
    await prisma.payrollDeductionType.upsert({
      where: { code: seed.code },
      update: {}, // don't overwrite existing config
      create: {
        code: seed.code,
        name: seed.name,
        defaultAmount: seed.defaultAmount,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
    })
    console.log(`✓ ${seed.code}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
