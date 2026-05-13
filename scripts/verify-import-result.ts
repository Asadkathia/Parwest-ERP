// Verification harness for the most recent guard import.
// Reads the test guard + side-effect rows for CNIC 45301-4960111-6.
// Usage: npx ts-node --transpile-only scripts/verify-import-result.ts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const TARGET_CNIC = "45301-4960111-6"

async function main() {
  const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
  if (!url) throw new Error("DATABASE_URL not set")
  const prisma = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: url })) })

  // 1. Guard scalar + region info
  const guard = await prisma.guard.findUnique({
    where: { cnic: TARGET_CNIC },
    include: {
      region: { select: { name: true } },
      regionalOffice: { select: { name: true, seriesCode: true } },
      judicialCases: true,
    },
  })

  if (!guard) {
    console.log("❌ NO GUARD FOUND for CNIC", TARGET_CNIC)
    await prisma.$disconnect()
    return
  }

  console.log("=== 1. Guard record ===")
  console.log("  parwestId      :", guard.parwestId)
  console.log("  name           :", guard.name)
  console.log("  cnic           :", guard.cnic)
  console.log("  dateOfBirth    :", guard.dateOfBirth?.toISOString().slice(0, 10) ?? "—")
  console.log("  fatherName     :", guard.fatherName ?? "—")
  console.log("  motherName     :", guard.motherName ?? "—")
  console.log("  religion       :", guard.religion ?? "—")
  console.log("  bloodGroup     :", guard.bloodGroup ?? "—")
  console.log("  addressCurrent :", (guard.addressCurrent ?? "—").slice(0, 70))
  console.log("  addressPermanent:", (guard.addressPermanent ?? "—").slice(0, 70))
  console.log("  maritalStatus  :", guard.maritalStatus ?? "—")
  console.log("  status         :", guard.status, "/ lifecycle:", guard.lifecycleStatus)
  console.log("  office         :", guard.regionalOffice?.name ?? "—", `(seriesCode=${guard.regionalOffice?.seriesCode ?? "—"})`)
  console.log("  region         :", guard.region?.name ?? "—")

  const nr = guard.nearestRelativesJson ? JSON.parse(guard.nearestRelativesJson) : []
  console.log("  nearestRelatives:", Array.isArray(nr) ? `${nr.length} entries` : "—")
  for (const r of nr) console.log("     -", JSON.stringify(r).slice(0, 100))

  const fm = guard.familyMembersJson ? JSON.parse(guard.familyMembersJson) : []
  console.log("  familyMembers   :", Array.isArray(fm) ? `${fm.length} entries` : "—")

  const pe = guard.previousEmploymentsJson ? JSON.parse(guard.previousEmploymentsJson) : []
  console.log("  prevEmployments :", Array.isArray(pe) ? `${pe.length} entries` : "—")

  // 2. Judicial cases (relation)
  console.log("\n=== 2. Judicial cases ===")
  console.log("  count:", guard.judicialCases.length)
  for (const j of guard.judicialCases) {
    console.log("     -", j.caseNo, "/", j.caseDate?.toISOString().slice(0, 10), "/", j.policeStation)
  }

  // 3. Service history
  const svc = await prisma.guardServiceHistory.findMany({
    where: { cnic: TARGET_CNIC },
    orderBy: { createdAt: "desc" },
  })
  console.log("\n=== 3. Service history ===")
  console.log("  count:", svc.length)
  for (const s of svc) {
    console.log(`   - [${s.event}] ${s.description ?? "—"}  @${s.createdAt.toISOString().slice(0, 19)}`)
  }

  // 4. Status history
  const sts = await prisma.guardStatusHistory.findMany({
    where: { cnic: TARGET_CNIC },
    orderBy: { createdAt: "desc" },
  })
  console.log("\n=== 4. Status history ===")
  console.log("  count:", sts.length)
  for (const s of sts) {
    console.log(`   - [${s.changedByType}] ${s.fromStatus ?? "(none)"} → ${s.toStatus}  reason: ${s.reason ?? "—"}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
