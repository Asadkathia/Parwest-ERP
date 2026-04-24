/**
 * One-time fix: grant ADMIN_APPROVALS (all actions) to any role that already
 * has canView=true for every other core module. This backfills the new
 * ADMIN_APPROVALS module for pre-existing admin roles whose RolePermission
 * rows were seeded before ADMIN_APPROVALS existed.
 *
 * Run with: npx tsx scripts/grant-admin-approvals.ts
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

const CORE_MODULES = [
    "GUARDS",
    "PAYROLL",
    "INVENTORY",
    "USERS",
    "CLIENTS",
    "TICKETING",
    "SETTINGS",
    "REPORTS",
    "IMPORTS",
    "REQUISITIONS",
    "AUDIT",
]

async function main() {
    const roles = await prisma.role.findMany({
        include: { rolePermissions: true },
    })

    for (const role of roles) {
        const modulesWithView = new Set(
            role.rolePermissions
                .filter((p) => p.canView)
                .map((p) => p.module)
        )
        const hasAllCore = CORE_MODULES.every((m) => modulesWithView.has(m))
        const hasAdminApprovals = role.rolePermissions.some((p) => p.module === "ADMIN_APPROVALS")

        if (hasAllCore && !hasAdminApprovals) {
            await prisma.rolePermission.create({
                data: {
                    roleId: role.id,
                    module: "ADMIN_APPROVALS",
                    canCreate: true,
                    canView: true,
                    canUpdate: true,
                    canDelete: true,
                    canRequisition: false,
                },
            })
            console.log(`✓ Granted ADMIN_APPROVALS to role "${role.name}"`)
        } else if (hasAdminApprovals) {
            console.log(`• Role "${role.name}" already has ADMIN_APPROVALS — skipping`)
        } else {
            console.log(`• Role "${role.name}" does not have all core modules — skipping`)
        }
    }

    console.log("Done.")
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
