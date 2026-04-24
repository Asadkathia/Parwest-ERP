#!/usr/bin/env node
/**
 * Debug why `/users?regionId=__GLOBAL__` returns 0 rows.
 * Replicates the exact Prisma query the page runs.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
const pool = new Pool({ connectionString: url })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

try {
  // Raw table dump so we see the actual regionId value for admin.
  const rows = await prisma.$queryRawUnsafe(
    `SELECT email, "regionId", "regionalOfficeId" FROM "User"`
  )
  console.log("Raw User table rows:")
  console.log(rows)

  console.log("\nQuery: where regionId = null")
  const nullRegion = await prisma.user.findMany({
    where: { regionId: null },
    select: { email: true, regionId: true },
  })
  console.log(nullRegion)

  console.log("\nQuery: where regionId IS NULL (via raw SQL)")
  const rawNull = await prisma.$queryRawUnsafe(
    `SELECT email, "regionId" FROM "User" WHERE "regionId" IS NULL`
  )
  console.log(rawNull)
} finally {
  await prisma.$disconnect()
  await pool.end()
}
