import { prisma } from "@/lib/db"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import type { ManagerScope } from "@/lib/access/scope"
import { buildManagerScopeWhere } from "@/lib/access/scope"
import { clientScopeWhere } from "@/lib/clients/access"
import type { DashboardRole } from "./role"

export type KpiSeries = {
  label: string
  value: number
  deltaToday: number
  sparkline: number[]
  href: string
  tone: "brand" | "success" | "warning" | "danger"
}

export type AttentionItem = {
  key: string
  label: string
  count: number
  href: string
  tone: "warning" | "danger"
}

export type ActivityEntry = {
  id: string
  actor: string
  module: string
  event: string
  description: string | null
  createdAt: string
}

export type ExpiringItem = {
  id: string
  label: string
  sub: string
  date: string
  kind: "doc" | "contract" | "cnic"
  href: string
}

export type FinanceSnapshot = {
  buckets: { label: string; amount: number; count: number }[]
  mtdCollected: number
  mtdPriorCollected: number
  topOverdue: { id: string; client: string; amount: number; dueDate: string | null; invoiceNumber: string }[]
  payrollCycleState: string | null
  payrollCycleMonth: string | null
}

export type MyQueueCounts = {
  myTickets: number
  myApprovals: number
  unreadTickets: number
}

export type DashboardData = {
  kpis: KpiSeries[]
  attention: AttentionItem[]
  activity: ActivityEntry[]
  expiring: { docs: ExpiringItem[]; contracts: ExpiringItem[] }
  finance: FinanceSnapshot | null
  payrollCycleState: string | null
  payrollCycleMonth: string | null
  myQueue: MyQueueCounts
  mapClients: { id: string; name: string; city: string | null; latitude: number | null; longitude: number | null }[]
  mapOffices: { id: string; name: string; seriesCode: string; address: string | null; latitude: number | null; longitude: number | null }[]
  generatedAtMs: number
}

const DAY_MS = 86_400_000

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x
}
function bucketByDay(rows: { createdAt: Date }[], days: number): number[] {
  const today = startOfDay(new Date()).getTime()
  const buckets = new Array(days).fill(0)
  for (const r of rows) {
    const d = startOfDay(new Date(r.createdAt)).getTime()
    const idx = days - 1 - Math.floor((today - d) / DAY_MS)
    if (idx >= 0 && idx < days) buckets[idx] += 1
  }
  return buckets
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise
  } catch (err) {
    if (!isPrismaMissingSchemaError(err)) {
      console.error("dashboard query failed:", err)
    }
    return fallback
  }
}

export async function loadDashboardData(params: {
  userId: string | null
  role: DashboardRole
  scope: ManagerScope | null
  showFinance: boolean
}): Promise<DashboardData> {
  const { userId, scope, showFinance } = params
  const guardScope = buildManagerScopeWhere(scope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" })
  // Clients are region-less (B1): scope by branches (or own region when branchless).
  const clientScope = clientScopeWhere(scope)
  const deploymentScope = buildManagerScopeWhere(scope, { regionalOfficeId: "regionalOfficeId" })

  const now = new Date()
  const since14 = new Date(now.getTime() - 13 * DAY_MS)
  since14.setHours(0, 0, 0, 0)
  const todayStart = startOfDay(now)
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS)
  const in30 = new Date(now.getTime() + 30 * DAY_MS)
  const monthStart = startOfMonth(now)
  const priorMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const priorMonthEnd = monthStart

  const [
    activeGuards,
    activeDeployments,
    openTickets,
    vacantGuards,
    docsExpiring30,
    cnicExpiring30,
    pendingApprovals,
    pendingClearanceGuards,
    contractsExpiring,
    guardCreated14,
    deploymentCreated14,
    ticketCreated14,
    currentPayroll,
    auditLogs,
    expiringPrereqs,
    expiringCnicList,
    expiringContractList,
    mapClientsRaw,
    mapOfficesRaw,
    myTickets,
    myApprovals,
  ] = await Promise.all([
    safe(prisma.guard.count({ where: { lifecycleStatus: "ACTIVE", ...guardScope } }), 0),
    safe(prisma.deployment.count({ where: { status: "ACTIVE", ...deploymentScope } }), 0),
    safe(
      prisma.ticket.count({
        where: { status: { name: { notIn: ["CLOSED", "RESOLVED", "COMPLETED", "Closed", "Resolved"] } } },
      }),
      0
    ),
    safe(
      prisma.guard.count({
        where: {
          lifecycleStatus: "ACTIVE",
          ...guardScope,
          deployments: { none: { status: "ACTIVE" } },
        },
      }),
      0
    ),
    safe(
      prisma.guardPrerequisite.count({
        where: {
          status: { not: "REJECTED" },
          expiryDate: { gte: now, lte: in30 },
          guard: { ...guardScope },
        },
      }),
      0
    ),
    safe(
      prisma.guard.count({
        where: { ...guardScope, cnicExpiryDate: { gte: now, lte: in30 } },
      }),
      0
    ),
    safe(prisma.guardAgeApproval.count({ where: { status: "PENDING" } }), 0),
    safe(prisma.guard.count({ where: { lifecycleStatus: "PENDING", ...guardScope } }), 0),
    safe(
      prisma.clientContract.count({
        where: { isActive: true, endDate: { gte: now, lte: in30 } },
      }),
      0
    ),
    safe(
      prisma.guard.findMany({
        where: { createdAt: { gte: since14 }, ...guardScope },
        select: { createdAt: true },
      }),
      [] as { createdAt: Date }[]
    ),
    safe(
      prisma.deployment.findMany({
        where: { createdAt: { gte: since14 }, ...deploymentScope },
        select: { createdAt: true },
      }),
      [] as { createdAt: Date }[]
    ),
    safe(
      prisma.ticket.findMany({
        where: { createdAt: { gte: since14 } },
        select: { createdAt: true },
      }),
      [] as { createdAt: Date }[]
    ),
    safe(
      prisma.payroll.findFirst({
        where: { month: monthStart },
        select: { state: true, month: true },
        orderBy: { updatedAt: "desc" },
      }),
      null as { state: string; month: Date } | null
    ),
    safe(
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          event: true,
          module: true,
          description: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
      [] as Array<{
        id: string
        event: string
        module: string
        description: string | null
        createdAt: Date
        user: { name: string | null } | null
      }>
    ),
    safe(
      prisma.guardPrerequisite.findMany({
        where: {
          status: { not: "REJECTED" },
          expiryDate: { gte: now, lte: in30 },
          guard: { ...guardScope },
        },
        orderBy: { expiryDate: "asc" },
        take: 6,
        select: {
          id: true,
          docTypeName: true,
          expiryDate: true,
          guard: { select: { id: true, name: true, parwestId: true } },
        },
      }),
      [] as Array<{
        id: string
        docTypeName: string
        expiryDate: Date | null
        guard: { id: string; name: string; parwestId: string }
      }>
    ),
    safe(
      prisma.guard.findMany({
        where: { ...guardScope, cnicExpiryDate: { gte: now, lte: in30 } },
        orderBy: { cnicExpiryDate: "asc" },
        take: 6,
        select: { id: true, name: true, parwestId: true, cnicExpiryDate: true },
      }),
      [] as Array<{ id: string; name: string; parwestId: string; cnicExpiryDate: Date | null }>
    ),
    safe(
      prisma.clientContract.findMany({
        where: { isActive: true, endDate: { gte: now, lte: in30 } },
        orderBy: { endDate: "asc" },
        take: 6,
        select: {
          id: true,
          endDate: true,
          client: { select: { id: true, name: true } },
        },
      }),
      [] as Array<{
        id: string
        endDate: Date | null
        client: { id: string; name: string }
      }>
    ),
    safe(
      prisma.client.findMany({
        where: { ...clientScope },
        select: { id: true, name: true, city: true, latitude: true, longitude: true },
      }),
      [] as Array<{ id: string; name: string; city: string | null; latitude: number | null; longitude: number | null }>
    ),
    safe(
      prisma.regionalOffice.findMany({
        select: {
          id: true,
          name: true,
          seriesCode: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      }),
      [] as Array<{
        id: string
        name: string
        seriesCode: string
        address: string | null
        latitude: number | null
        longitude: number | null
      }>
    ),
    userId
      ? safe(
          prisma.ticket.count({
            where: {
              assignedToId: userId,
              status: { name: { notIn: ["CLOSED", "RESOLVED", "COMPLETED", "Closed", "Resolved"] } },
            },
          }),
          0
        )
      : Promise.resolve(0),
    safe(prisma.guardAgeApproval.count({ where: { status: "PENDING" } }), 0),
  ])

  // Finance snapshot — only load if visible
  let finance: FinanceSnapshot | null = null
  if (showFinance) {
    const clientWhere = Object.keys(clientScope).length > 0 ? { client: clientScope } : {}
    const [openInvoices, mtdPaid, priorPaid, topOverdueRaw] = await Promise.all([
      safe(
        prisma.invoice.findMany({
          where: {
            ...clientWhere,
            status: { notIn: ["PAID", "VOID"] },
            dueDate: { not: null },
          },
          select: { id: true, amount: true, paidAmount: true, dueDate: true, status: true },
        }),
        [] as Array<{ id: string; amount: number; paidAmount: number; dueDate: Date | null; status: string }>
      ),
      safe(
        prisma.invoice.aggregate({
          _sum: { paidAmount: true },
          where: { ...clientWhere, paidAt: { gte: monthStart } },
        }),
        { _sum: { paidAmount: 0 } } as { _sum: { paidAmount: number | null } }
      ),
      safe(
        prisma.invoice.aggregate({
          _sum: { paidAmount: true },
          where: { ...clientWhere, paidAt: { gte: priorMonthStart, lt: priorMonthEnd } },
        }),
        { _sum: { paidAmount: 0 } } as { _sum: { paidAmount: number | null } }
      ),
      safe(
        prisma.invoice.findMany({
          where: {
            ...clientWhere,
            status: { notIn: ["PAID", "VOID"] },
            dueDate: { lt: now },
          },
          orderBy: { dueDate: "asc" },
          take: 5,
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            paidAmount: true,
            dueDate: true,
            client: { select: { name: true } },
          },
        }),
        [] as Array<{
          id: string
          invoiceNumber: string
          amount: number
          paidAmount: number
          dueDate: Date | null
          client: { name: string }
        }>
      ),
    ])

    const buckets = [
      { label: "Current", min: -Infinity, max: 0, amount: 0, count: 0 },
      { label: "1–30d", min: 0, max: 30, amount: 0, count: 0 },
      { label: "31–60d", min: 30, max: 60, amount: 0, count: 0 },
      { label: "61–90d", min: 60, max: 90, amount: 0, count: 0 },
      { label: "90d+", min: 90, max: Infinity, amount: 0, count: 0 },
    ]
    for (const inv of openInvoices) {
      if (!inv.dueDate) continue
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / DAY_MS)
      const outstanding = Math.max(0, (inv.amount || 0) - (inv.paidAmount || 0))
      const bucket = buckets.find((b) => daysOverdue > b.min && daysOverdue <= b.max)
      if (bucket) {
        bucket.amount += outstanding
        bucket.count += 1
      }
    }

    finance = {
      buckets: buckets.map((b) => ({ label: b.label, amount: b.amount, count: b.count })),
      mtdCollected: mtdPaid._sum.paidAmount ?? 0,
      mtdPriorCollected: priorPaid._sum.paidAmount ?? 0,
      topOverdue: topOverdueRaw.map((i) => ({
        id: i.id,
        client: i.client.name,
        amount: Math.max(0, (i.amount || 0) - (i.paidAmount || 0)),
        dueDate: i.dueDate ? i.dueDate.toISOString() : null,
        invoiceNumber: i.invoiceNumber,
      })),
      payrollCycleState: currentPayroll?.state ?? null,
      payrollCycleMonth: currentPayroll?.month ? currentPayroll.month.toISOString() : null,
    }
  }

  // Sparklines + deltas
  const guardSpark = bucketByDay(guardCreated14, 14)
  const depSpark = bucketByDay(deploymentCreated14, 14)
  const ticketSpark = bucketByDay(ticketCreated14, 14)
  const ticketTodayCount = ticketCreated14.filter((r) => new Date(r.createdAt) >= todayStart).length
  const ticketYesterdayCount = ticketCreated14.filter(
    (r) => new Date(r.createdAt) >= yesterdayStart && new Date(r.createdAt) < todayStart
  ).length

  const kpis: KpiSeries[] = [
    {
      label: "Active Guards",
      value: activeGuards,
      deltaToday: guardSpark[guardSpark.length - 1],
      sparkline: guardSpark,
      href: "/guards",
      tone: "brand",
    },
    {
      label: "Deployed",
      value: activeDeployments,
      deltaToday: depSpark[depSpark.length - 1],
      sparkline: depSpark,
      href: "/deployments",
      tone: "success",
    },
    {
      label: "Vacant Guards",
      value: vacantGuards,
      deltaToday: 0,
      sparkline: [],
      href: "/guards?status=DEFAULT",
      tone: vacantGuards > 0 ? "warning" : "success",
    },
    {
      label: "Open Tickets",
      value: openTickets,
      deltaToday: ticketTodayCount - ticketYesterdayCount,
      sparkline: ticketSpark,
      href: "/tickets",
      tone: "warning",
    },
    {
      label: "Pending Approvals",
      value: pendingApprovals + pendingClearanceGuards,
      deltaToday: 0,
      sparkline: [],
      href: "/admin-approvals",
      tone: "warning",
    },
    {
      label: "Payroll Cycle",
      value: 0,
      deltaToday: 0,
      sparkline: [],
      href: "/payroll",
      tone: payrollCycleTone(currentPayroll?.state ?? null),
    },
  ]

  const attention: AttentionItem[] = []
  if (vacantGuards > 0)
    attention.push({
      key: "vacant",
      label: `${vacantGuards} verified guard${vacantGuards === 1 ? "" : "s"} available to deploy`,
      count: vacantGuards,
      href: "/guards?status=DEFAULT",
      tone: "warning",
    })
  if (docsExpiring30 + cnicExpiring30 > 0)
    attention.push({
      key: "docs",
      label: `${docsExpiring30 + cnicExpiring30} guard document${
        docsExpiring30 + cnicExpiring30 === 1 ? "" : "s"
      } expiring in 30 days`,
      count: docsExpiring30 + cnicExpiring30,
      href: "/guards",
      tone: "warning",
    })
  if (pendingApprovals + pendingClearanceGuards > 0)
    attention.push({
      key: "approvals",
      label: `${pendingApprovals + pendingClearanceGuards} pending approval${
        pendingApprovals + pendingClearanceGuards === 1 ? "" : "s"
      }`,
      count: pendingApprovals + pendingClearanceGuards,
      href: "/admin-approvals",
      tone: "warning",
    })
  if (contractsExpiring > 0)
    attention.push({
      key: "contracts",
      label: `${contractsExpiring} client contract${contractsExpiring === 1 ? "" : "s"} expiring in 30 days`,
      count: contractsExpiring,
      href: "/clients",
      tone: "warning",
    })
  if (finance) {
    const overdue90 = finance.buckets.find((b) => b.label === "90d+")?.amount ?? 0
    if (overdue90 > 0)
      attention.push({
        key: "ar90",
        label: `₨ ${formatShortMoney(overdue90)} A/R overdue over 90 days`,
        count: 1,
        href: "/clients/invoicing",
        tone: "danger",
      })
  }

  const activity: ActivityEntry[] = auditLogs.map((l) => ({
    id: l.id,
    actor: l.user?.name ?? "System",
    module: l.module,
    event: l.event,
    description: l.description,
    createdAt: l.createdAt.toISOString(),
  }))

  const docs: ExpiringItem[] = [
    ...expiringPrereqs.map((p) => ({
      id: p.id,
      label: `${p.guard.name} — ${p.docTypeName}`,
      sub: p.guard.parwestId,
      date: p.expiryDate ? p.expiryDate.toISOString() : "",
      kind: "doc" as const,
      href: `/guards/${p.guard.id}`,
    })),
    ...expiringCnicList.map((g) => ({
      id: `cnic-${g.id}`,
      label: `${g.name} — CNIC`,
      sub: g.parwestId,
      date: g.cnicExpiryDate ? g.cnicExpiryDate.toISOString() : "",
      kind: "cnic" as const,
      href: `/guards/${g.id}`,
    })),
  ]
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(0, 8)

  const contracts: ExpiringItem[] = expiringContractList.map((c) => ({
    id: c.id,
    label: c.client.name,
    sub: "Contract",
    date: c.endDate ? c.endDate.toISOString() : "",
    kind: "contract" as const,
    href: `/clients/${c.client.id}`,
  }))

  return {
    kpis,
    attention,
    activity,
    expiring: { docs, contracts },
    finance,
    payrollCycleState: currentPayroll?.state ?? null,
    payrollCycleMonth: currentPayroll?.month ? currentPayroll.month.toISOString() : null,
    myQueue: { myTickets, myApprovals, unreadTickets: 0 },
    mapClients: mapClientsRaw,
    mapOffices: mapOfficesRaw,
    generatedAtMs: now.getTime(),
  }
}

function payrollCycleTone(state: string | null): KpiSeries["tone"] {
  if (!state) return "warning"
  if (state === "PAID" || state === "GLOBAL_FINALIZED") return "success"
  if (state === "HOLD" || state === "EMERGENCY_RELEASED") return "danger"
  return "warning"
}

export function formatShortMoney(value: number): string {
  if (!Number.isFinite(value)) return "0"
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`
  if (abs >= 1_00_000) return `${(value / 1_00_000).toFixed(1)}L`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

export function formatPayrollState(state: string | null): string {
  if (!state) return "Not started"
  return state.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
