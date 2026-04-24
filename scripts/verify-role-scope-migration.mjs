#!/usr/bin/env node
/**
 * Verify the add_role_scope_type migration landed correctly.
 * Prints every role with its scopeType.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const url =
  process.env.DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED

if (!url) {
  console.error("No DATABASE_URL in env.")
  process.exit(1)
}

const pool = new Pool({ connectionString: url })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

try {
  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    select: { name: true, scopeType: true },
  })
  console.log("Roles after migration:")
  for (const r of roles) {
    const marker = r.scopeType === "GLOBAL" ? "🌐" : "📍"
    console.log(`  ${marker} ${r.name.padEnd(18)} ${r.scopeType}`)
  }
} finally {
  await prisma.$disconnect()
  await pool.end()
}
