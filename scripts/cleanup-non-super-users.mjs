#!/usr/bin/env node
/**
 * Delete every user except admin@parwestgroup.com (Super User).
 * Cascades through all tables that FK-reference User.
 * Roles are left untouched — use the Roles UI to prune if needed.
 *
 * Run: node -r dotenv/config scripts/cleanup-non-super-users.mjs dotenv_config_path=.env.local
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

async function main() {
  const keeper = await prisma.user.findUnique({
    where: { email: "admin@parwestgroup.com" },
    include: { role: { select: { name: true, scopeType: true } } },
  })
  if (!keeper) {
    throw new Error("admin@parwestgroup.com not found — aborting.")
  }
  if (keeper.role?.name !== "Super User") {
    throw new Error(
      `admin@parwestgroup.com has role "${keeper.role?.name}" — expected "Super User". ` +
      `Promote via scripts/promote-user-role.mjs first, then retry.`
    )
  }
  console.log(`Keeper: ${keeper.email} (${keeper.role.name}, ${keeper.role.scopeType})`)

  const doomed = await prisma.user.findMany({
    where: { id: { not: keeper.id } },
    select: { id: true, email: true, role: { select: { name: true } } },
  })
  console.log(`Users to delete: ${doomed.length}`)

  const otherId = { not: keeper.id }

  // Clear tables that FK-reference User, in order.
  await prisma.managerSupervisorAssignment.deleteMany({
    where: { OR: [{ managerId: otherId }, { supervisorId: otherId }] },
  })
  console.log("  ✓ ManagerSupervisorAssignment")

  await prisma.clientSupervisorAssignment.deleteMany({ where: { supervisorId: otherId } })
  console.log("  ✓ ClientSupervisorAssignment")

  await prisma.guardSupervisorAssignment.deleteMany({ where: { supervisorId: otherId } })
  console.log("  ✓ GuardSupervisorAssignment")

  await prisma.ticket.deleteMany({
    where: { OR: [{ senderId: otherId }, { assignedToId: otherId }] },
  })
  console.log("  ✓ Tickets")

  await prisma.requisition.deleteMany({
    where: { OR: [{ requesterId: otherId }, { approverId: otherId }] },
  })
  console.log("  ✓ Requisitions")

  await prisma.storeInventoryAssignment.deleteMany({
    where: {
      OR: [
        { assignedByUserId: otherId },
        { assignedToUserId: otherId },
        { returnedByUserId: otherId },
      ],
    },
  })
  console.log("  ✓ StoreInventoryAssignment")

  await prisma.storeInventoryMovement.deleteMany({ where: { performedById: otherId } })
  console.log("  ✓ StoreInventoryMovement")

  await prisma.storeInventoryDemandResponse.deleteMany({ where: { responderId: otherId } })
  console.log("  ✓ StoreInventoryDemandResponse")

  await prisma.storeInventoryDemand.deleteMany({
    where: { OR: [{ requestedById: otherId }, { approvedById: otherId }] },
  })
  console.log("  ✓ StoreInventoryDemand")

  await prisma.storeInventoryAdjustment.deleteMany({ where: { createdById: otherId } })
  console.log("  ✓ StoreInventoryAdjustment")

  await prisma.storeInventoryPurchase.deleteMany({
    where: { OR: [{ createdById: otherId }, { approvedById: otherId }] },
  })
  console.log("  ✓ StoreInventoryPurchase")

  await prisma.auditLog.deleteMany({ where: { userId: otherId } })
  console.log("  ✓ AuditLog")

  // UserPermission + UserStatusHistory cascade on User delete via the schema.
  const deleted = await prisma.user.deleteMany({ where: { id: otherId } })
  console.log(`  ✓ Users: ${deleted.count}`)

  // Scrub any user-level permission overrides on the keeper so the session
  // is a clean Super User with no overrides.
  await prisma.userPermission.deleteMany({ where: { userId: keeper.id } })
  console.log("  ✓ Cleared userPermission overrides on keeper")

  const remaining = await prisma.user.findMany({
    select: { email: true, role: { select: { name: true } } },
  })
  console.log("\n── Remaining users ──")
  for (const u of remaining) {
    console.log(`  ${u.email} (${u.role?.name ?? "—"})`)
  }
}

try {
  await main()
} catch (err) {
  console.error("Failed:", err.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
  await pool.end()
}
