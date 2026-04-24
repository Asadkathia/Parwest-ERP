#!/usr/bin/env node
/**
 * Read-only diagnostic. Prints the full user list with their role + region
 * so you can confirm what cleanup-users is about to remove.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
if (!url) {
  console.error("No DATABASE_URL in env.")
  process.exit(1)
}

const pool = new Pool({ connectionString: url })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

try {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      email: true,
      name: true,
      status: true,
      createdAt: true,
      role: { select: { name: true, scopeType: true } },
      region: { select: { name: true } },
      regionalOffice: { select: { name: true } },
    },
  })
  console.log(`Target DB: ${new URL(url).host}`)
  console.log(`Total users: ${users.length}\n`)
  for (const u of users) {
    const tag = u.role?.name === "Super User" ? " [SUPER USER — KEEP]" : ""
    console.log(`  ${u.email.padEnd(40)} ${String(u.role?.name ?? "(no role)").padEnd(18)} ${u.region?.name ?? "—"}${tag}`)
  }
} finally {
  await prisma.$disconnect()
  await pool.end()
}
