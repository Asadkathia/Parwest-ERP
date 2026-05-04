import { ok } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { prisma } from "@/lib/db"

export async function GET() {
  const { error } = await requireReportsAccess()
  if (error) return error

  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000)
  const last30Start = new Date(now.getTime() - 30 * 24 * 3600 * 1000)

  const [
    totalGuards,
    deployedGuards,
    totalClients,
    activeBranches,
    pendingVerifications,
    expiringDocs,
  ] = await Promise.all([
    prisma.guard.count(),
    prisma.deployment.count({ where: { status: "ACTIVE" } }),
    prisma.client.count(),
    prisma.branch.count({ where: { status: "ACTIVE" } }),
    prisma.guard.count({ where: { lifecycleStatus: "PENDING" } }),
    prisma.guard.count({
      where: { cnicExpiryDate: { gte: now, lte: in30 } },
    }),
  ])

  const availableGuards = await prisma.guard.count({
    where: {
      lifecycleStatus: "ACTIVE",
      deployments: { none: { status: "ACTIVE" } },
    },
  })

  const guardlessBranches = await prisma.branch.count({
    where: {
      status: "ACTIVE",
      deployments: { none: { status: "ACTIVE" } },
    },
  })

  const deployTrend = await prisma.$queryRawUnsafe<{ day: Date; count: bigint }[]>(
    `SELECT date_trunc('day', "deploymentDate") AS day, COUNT(*)::bigint AS count
     FROM "Deployment"
     WHERE "deploymentDate" >= $1
     GROUP BY 1 ORDER BY 1`,
    last30Start
  )

  // Salary MoM — last 6 months
  const sixMonthsAgo = new Date(
    now.getFullYear(),
    now.getMonth() - 5,
    1
  )
  const salaryMoM = await prisma.$queryRawUnsafe<
    { month: Date; total: number }[]
  >(
    `SELECT date_trunc('month', "month") AS month, COALESCE(SUM("netSalary"), 0)::float AS total
     FROM "Payroll"
     WHERE "month" >= $1
     GROUP BY 1 ORDER BY 1`,
    sixMonthsAgo
  )

  // Inventory by status — sums quantity across all stores per balance bucket.
  const invAgg = await prisma.storeInventoryBalance.aggregate({
    _sum: {
      quantityOnHand: true,
      quantityHeld: true,
      quantityIssued: true,
    },
  })

  const inventoryByStatus = [
    { status: "On hand", count: invAgg._sum.quantityOnHand ?? 0 },
    { status: "Held", count: invAgg._sum.quantityHeld ?? 0 },
    { status: "Issued", count: invAgg._sum.quantityIssued ?? 0 },
  ]

  return ok({
    kpis: {
      totalGuards,
      deployedGuards,
      availableGuards,
      totalClients,
      activeBranches,
      guardlessBranches,
      pendingVerifications,
      expiringDocs,
    },
    deployTrend: deployTrend.map((r) => ({
      day: r.day,
      count: Number(r.count),
    })),
    salaryMoM: salaryMoM.map((r) => ({
      month: r.month,
      total: Number(r.total),
    })),
    inventoryByStatus,
  })
}
