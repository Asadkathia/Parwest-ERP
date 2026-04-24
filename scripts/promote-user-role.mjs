#!/usr/bin/env node
/**
 * Promote (or demote) a user to a given role by email.
 *
 * Usage:
 *   node scripts/promote-user-role.mjs <email> <roleName>
 *
 * Example:
 *   node scripts/promote-user-role.mjs admin@parwestgroup.com "Super User"
 *   node scripts/promote-user-role.mjs admin@parwestgroup.com "Admin"   # revert
 *
 * Reads DATABASE_URL (or POSTGRES_* fallbacks) from the environment, same as
 * prisma/seed.ts. Confirms the target DB host before writing.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const [, , emailArg, roleArg] = process.argv
if (!emailArg || !roleArg) {
  console.error("Usage: node scripts/promote-user-role.mjs <email> <roleName>")
  process.exit(1)
}

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING

if (!databaseUrl) {
  console.error("No DATABASE_URL in env. Aborting.")
  process.exit(1)
}

const host = (() => {
  try {
    return new URL(databaseUrl).host
  } catch {
    return "<unparseable>"
  }
})()

console.log(`Target DB host: ${host}`)
console.log(`Promoting ${emailArg} -> role "${roleArg}"`)

const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const role = await prisma.role.findUnique({ where: { name: roleArg } })
  if (!role) {
    throw new Error(`Role "${roleArg}" not found. Available roles: ` +
      (await prisma.role.findMany({ select: { name: true } })).map(r => r.name).join(", "))
  }

  const user = await prisma.user.findUnique({
    where: { email: emailArg },
    include: { role: { select: { name: true } } },
  })
  if (!user) throw new Error(`User ${emailArg} not found.`)

  if (user.roleId === role.id) {
    console.log(`No change: user is already "${roleArg}".`)
    return
  }

  const previousRole = user.role?.name ?? "(none)"
  await prisma.user.update({
    where: { id: user.id },
    data: { roleId: role.id },
  })

  console.log(`✓ ${emailArg}: ${previousRole} -> ${roleArg}`)
}

main()
  .catch((err) => {
    console.error(err.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
