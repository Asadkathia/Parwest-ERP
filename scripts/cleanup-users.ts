/**
 * One-time cleanup script:
 * - Keeps only admin@parwestgroup.com (Admin role)
 * - Deletes all other users and all roles except "Admin"
 *
 * Run with: npx tsx scripts/cleanup-users.ts
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env" })

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
if (!databaseUrl) throw new Error("DATABASE_URL not set")

const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as never)

async function main() {
    console.log("Starting cleanup...")

    const superAdmin = await prisma.user.findUnique({
        where: { email: "admin@parwestgroup.com" },
        include: { role: true },
    })

    if (!superAdmin) {
        console.error("ERROR: admin@parwestgroup.com not found. Aborting.")
        process.exit(1)
    }
    console.log(`Found SuperAdmin: ${superAdmin.name} (id: ${superAdmin.id})`)

    const otherId = { not: superAdmin.id }

    // Delete in FK dependency order — clear all records referencing non-admin users first
    await prisma.managerSupervisorAssignment.deleteMany({
        where: { OR: [{ managerId: otherId }, { supervisorId: otherId }] },
    })
    console.log("Cleared ManagerSupervisorAssignment")

    await prisma.clientSupervisorAssignment.deleteMany({
        where: { supervisorId: otherId },
    })
    console.log("Cleared ClientSupervisorAssignment")

    await prisma.guardSupervisorAssignment.deleteMany({
        where: { supervisorId: otherId },
    })
    console.log("Cleared GuardSupervisorAssignment")

    await prisma.ticket.deleteMany({
        where: { OR: [{ senderId: otherId }, { assignedToId: otherId }] },
    })
    console.log("Cleared Tickets")

    await prisma.requisition.deleteMany({
        where: { OR: [{ requesterId: otherId }, { approverId: otherId }] },
    })
    console.log("Cleared Requisitions")

    await prisma.storeInventoryAssignment.deleteMany({
        where: {
            OR: [
                { assignedByUserId: otherId },
                { assignedToUserId: otherId },
                { returnedByUserId: otherId },
            ],
        },
    })
    console.log("Cleared StoreInventoryAssignments")

    await prisma.storeInventoryMovement.deleteMany({
        where: { performedById: otherId },
    })
    console.log("Cleared StoreInventoryMovements")

    await prisma.storeInventoryDemandResponse.deleteMany({
        where: { responderId: otherId },
    })
    console.log("Cleared StoreInventoryDemandResponses")

    await prisma.storeInventoryDemand.deleteMany({
        where: { OR: [{ requestedById: otherId }, { approvedById: otherId }] },
    })
    console.log("Cleared StoreInventoryDemands")

    await prisma.storeInventoryAdjustment.deleteMany({
        where: { createdById: otherId },
    })
    console.log("Cleared StoreInventoryAdjustments")

    await prisma.storeInventoryPurchase.deleteMany({
        where: { OR: [{ createdById: otherId }, { approvedById: otherId }] },
    })
    console.log("Cleared StoreInventoryPurchases")

    await prisma.auditLog.deleteMany({
        where: { userId: otherId },
    })
    console.log("Cleared AuditLogs")

    // Now safe to delete the users (UserPermission, UserStatusHistory cascade)
    const deletedUsers = await prisma.user.deleteMany({
        where: { id: otherId },
    })
    console.log(`Deleted ${deletedUsers.count} user(s).`)

    // Delete all roles except "Admin"
    const deletedRoles = await prisma.role.deleteMany({
        where: { name: { not: "Admin" } },
    })
    console.log(`Deleted ${deletedRoles.count} role(s).`)

    // Ensure SuperAdmin has no permissions
    await prisma.userPermission.deleteMany({ where: { userId: superAdmin.id } })

    const remainingUsers = await prisma.user.findMany({ select: { email: true } })
    const remainingRoles = await prisma.role.findMany({ select: { name: true } })

    console.log("\n--- Done ---")
    console.log("Users:", remainingUsers.map((u) => u.email))
    console.log("Roles:", remainingRoles.map((r) => r.name))
}

main()
    .catch((e) => {
        console.error("Cleanup failed:", e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())