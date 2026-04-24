#!/usr/bin/env node
/**
 * Null out regionId + regionalOfficeId for any user whose role is GLOBAL.
 * Fixes stale data from before the Role.scopeType migration, where
 * Super Users inherited a region/office from when they were regional roles.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
if (!url) {
  console.error("No DATABASE_URL in env.")
  process.exit(1)
}

console.log(`Target DB: ${new URL(url).host}`)
const pool = new Pool({ connectionString: url })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

try {
  const targets = await prisma.user.findMany({
    where: {
      role: { scopeType: "GLOBAL" },
      OR: [{ regionId: { not: null } }, { regionalOfficeId: { not: null } }],
    },
    select: { id: true, email: true },
  })
  if (targets.length === 0) {
    console.log("No stale rows — all GLOBAL-role users already have null region/office.")
  } else {
    console.log(`Clearing region/office on ${targets.length} GLOBAL-role user(s):`)
    for (const u of targets) console.log(`  - ${u.email}`)
    const result = await prisma.user.updateMany({
      where: { id: { in: targets.map((u) => u.id) } },
      data: { regionId: null, regionalOfficeId: null },
    })
    console.log(`✓ Updated ${result.count} row(s).`)
  }
} finally {
  await prisma.$disconnect()
  await pool.end()
}
