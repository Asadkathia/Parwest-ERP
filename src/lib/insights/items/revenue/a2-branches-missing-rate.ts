import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"
import { formatShortMoney } from "@/lib/dashboard/queries"

registerInsight({
  key: "branches-missing-rate",
  title: "A2 — Branches missing rate card",
  description:
    "Branches whose parent client has no rate card (or has a contract with zero rates). Revenue-at-risk via active deployments.",
  category: "EFFICIENCY",
  defaultSeverity: "MEDIUM",
  thresholdDocs: {},
  compute: async (ctx) => {
    const clientWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    // Pull clients in scope with their contracts + rate counts + branches.
    const clients = await ctx.prisma.client.findMany({
      where: {
        status: "ACTIVE",
        ...clientWhere,
      },
      select: {
        id: true,
        name: true,
        contracts: {
          select: {
            id: true,
            isActive: true,
            rates: { select: { id: true, rate: true } },
          },
        },
        branches: {
          select: { id: true, name: true },
        },
      },
    })

    // Determine clients missing rate cards.
    type MissingClient = {
      clientId: string
      clientName: string
      branches: { id: string; name: string }[]
    }
    const missing: MissingClient[] = []
    for (const c of clients) {
      const activeContracts = c.contracts.filter((k) => k.isActive)
      const noContracts = activeContracts.length === 0 && c.contracts.length === 0
      const hasAnyRate = c.contracts.some((k) => k.rates.length > 0)
      const activeHasNoRates =
        activeContracts.length > 0 && activeContracts.every((k) => k.rates.length === 0)
      if (noContracts || !hasAnyRate || activeHasNoRates) {
        if (c.branches.length > 0) {
          missing.push({ clientId: c.id, clientName: c.name, branches: c.branches })
        }
      }
    }

    if (missing.length === 0) return { count: 0, summary: "No issues" }

    // For each missing client, count active deployments grouped by branch.
    const clientIds = missing.map((m) => m.clientId)
    const deployments = await ctx.prisma.deployment.findMany({
      where: { status: "ACTIVE", clientId: { in: clientIds } },
      select: { clientId: true, branchId: true, rate: true },
    })

    // Discover a fallback default rate: median of any existing ClientContractRate rows globally.
    const anyRates = await ctx.prisma.clientContractRate.findMany({
      select: { rate: true },
      take: 500,
    })
    let fallbackRate = 0
    if (anyRates.length > 0) {
      const sorted = anyRates.map((r) => r.rate).sort((a, b) => a - b)
      fallbackRate = sorted[Math.floor(sorted.length / 2)] ?? 0
    }

    type BranchRow = {
      branchId: string
      branchName: string
      clientName: string
      activeCount: number
      estLoss: number
    }
    const branchRows: BranchRow[] = []
    let totalBranches = 0

    for (const m of missing) {
      totalBranches += m.branches.length
      const branchMap = new Map<string, { count: number; sumRate: number; rated: number }>()
      for (const d of deployments.filter((x) => x.clientId === m.clientId)) {
        if (!d.branchId) continue
        const entry = branchMap.get(d.branchId) ?? { count: 0, sumRate: 0, rated: 0 }
        entry.count += 1
        if (d.rate != null) {
          entry.sumRate += d.rate
          entry.rated += 1
        }
        branchMap.set(d.branchId, entry)
      }
      for (const b of m.branches) {
        const stats = branchMap.get(b.id)
        const activeCount = stats?.count ?? 0
        const avgRate = stats && stats.rated > 0 ? stats.sumRate / stats.rated : fallbackRate
        const estLoss = activeCount * avgRate * 30
        branchRows.push({
          branchId: b.id,
          branchName: b.name,
          clientName: m.clientName,
          activeCount,
          estLoss,
        })
      }
    }

    branchRows.sort((a, b) => b.estLoss - a.estLoss || b.activeCount - a.activeCount)
    const items = branchRows.slice(0, 5).map((b) => ({
      id: b.branchId,
      label: `${b.clientName} — ${b.branchName}`,
      sub:
        b.activeCount > 0
          ? `${b.activeCount} active deployment${b.activeCount === 1 ? "" : "s"} (no rate card)`
          : "No rate card",
      href: `/clients`,
      amount: b.estLoss > 0 ? b.estLoss : null,
    }))

    const totalEstLoss = branchRows.reduce((s, r) => s + r.estLoss, 0)
    const summary =
      totalEstLoss > 0
        ? `${totalBranches} branch${totalBranches === 1 ? "" : "es"} missing rate card (~₨${formatShortMoney(totalEstLoss)}/mo at risk)`
        : `${totalBranches} branch${totalBranches === 1 ? "" : "es"} missing rate card`

    return {
      count: totalBranches,
      amount: totalEstLoss > 0 ? totalEstLoss : undefined,
      summary,
      drillUrl: "/clients",
      items,
    }
  },
})
