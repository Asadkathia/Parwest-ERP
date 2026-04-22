import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Sparkles, Users, MessageSquareMore, ShieldCheck, Wallet } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import KpiCard from "@/components/dashboard/KpiCard"
import AttentionStrip from "@/components/dashboard/AttentionStrip"
import OpsFeed from "@/components/dashboard/OpsFeed"
import MyQueue from "@/components/dashboard/MyQueue"
import ExpiringRenewals from "@/components/dashboard/ExpiringRenewals"
import FinancePulse from "@/components/dashboard/FinancePulse"
import GuardClientMapCard from "@/components/dashboard/GuardClientMapCard"
import InsightsPanel from "@/components/dashboard/InsightsPanel"
import { deriveManagerScope } from "@/lib/access/scope"
import { resolveDashboardRole, roleVisibility, type DashboardRole } from "@/lib/dashboard/role"
import { loadDashboardData, formatPayrollState, type KpiSeries } from "@/lib/dashboard/queries"

const ROLE_LABELS: Record<DashboardRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_REGIONAL: "Regional Admin",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  ACCOUNTANT: "Accountant",
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const role = resolveDashboardRole(session)
  const permissions = (session.user?.permissions as string[] | undefined) ?? []
  const vis = roleVisibility(role, permissions)
  const scope = deriveManagerScope(session)
  const userId = (session.user as { id?: string } | undefined)?.id ?? null

  const data = await loadDashboardData({
    userId,
    role,
    scope,
    showFinance: vis.financePulse,
  })

  const kpiCards = pickKpis(data.kpis, vis.kpiSet)

  return (
    <div className="space-y-5">
      <SectionTitle
        title={`Good ${greeting()}, ${session.user?.name?.split(" ")[0] || "there"}`}
        subtitle={`${ROLE_LABELS[role]}${
          scope?.regionId ? " · Region-scoped view" : role === "SUPER_ADMIN" ? " · All regions" : ""
        }`}
        action={
          <div className="flex items-center gap-2">
            <QuickActions role={role} />
            <Link
              href="/dashboard/ai-chat"
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white shadow-[var(--shadow-xs)]"
            >
              <Sparkles className="h-4 w-4" />
              AI Chat
            </Link>
          </div>
        }
      />

      {vis.attentionStrip && data.attention.length > 0 ? <AttentionStrip items={data.attention} /> : null}

      {vis.kpiRow ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpiCards.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={renderKpiValue(k, data)}
              deltaToday={k.sparkline.length > 0 ? k.deltaToday : undefined}
              sparkline={k.sparkline}
              tone={k.tone}
              href={k.href}
              footer={kpiFooter(k, data)}
            />
          ))}
        </div>
      ) : null}

      {role === "SUPER_ADMIN" || role === "ADMIN_REGIONAL" || role === "ACCOUNTANT" ? (
        <InsightsPanel canManage={role === "SUPER_ADMIN"} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {vis.opsFeed ? <OpsFeed entries={data.activity} /> : null}
          {vis.coverageMap ? (
            <GuardClientMapCard clients={data.mapClients} regionalOffices={data.mapOffices} />
          ) : null}
          {vis.financePulse && data.finance ? <FinancePulse data={data.finance} nowMs={data.generatedAtMs} /> : null}
        </div>

        <div className="space-y-4">
          {vis.myQueue ? (
            <MyQueue counts={data.myQueue} userName={session.user?.name || "You"} />
          ) : null}
          {vis.expiringRenewals ? (
            <ExpiringRenewals docs={data.expiring.docs} contracts={data.expiring.contracts} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}

function pickKpis(kpis: KpiSeries[], set: "full" | "reduced" | "finance"): KpiSeries[] {
  if (set === "reduced") {
    return kpis.filter((k) => ["Active Guards", "Deployed", "Open Tickets"].includes(k.label))
  }
  if (set === "finance") {
    return kpis.filter((k) => ["Active Guards", "Open Tickets", "Payroll Cycle"].includes(k.label))
  }
  return kpis
}

type DashData = Awaited<ReturnType<typeof loadDashboardData>>

function renderKpiValue(k: KpiSeries, data: DashData): string | number {
  if (k.label === "Payroll Cycle") {
    return formatPayrollState(data.payrollCycleState)
  }
  return k.value
}

function kpiFooter(k: KpiSeries, data: DashData): React.ReactNode {
  if (k.label === "Payroll Cycle") {
    const month = data.payrollCycleMonth
    return month ? new Date(month).toLocaleString("en-US", { month: "long", year: "numeric" }) : "Current month"
  }
  if (k.label === "Vacant Guards" && k.value === 0) return "Everyone posted"
  if (k.label === "Pending Approvals" && k.value === 0) return "Nothing waiting"
  return null
}

function QuickActions({ role }: { role: DashboardRole }) {
  const actions: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = []
  if (role !== "ACCOUNTANT") {
    actions.push({ href: "/guards/docs-checklist", label: "Docs Checklist", icon: ShieldCheck })
  }
  if (role === "SUPER_ADMIN" || role === "ADMIN_REGIONAL" || role === "ACCOUNTANT") {
    actions.push({ href: "/clients/invoicing", label: "Invoicing", icon: Wallet })
  }
  if (role !== "ACCOUNTANT") {
    actions.push({ href: "/payroll/loans/bulk", label: "Bulk Loans", icon: Users })
  }
  actions.push({ href: "/dashboard/admin-center", label: "Admin Center", icon: MessageSquareMore })

  return (
    <details className="relative">
      <summary className="list-none inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]">
        Quick Action
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-[var(--shadow-md)]">
        <ul className="py-1">
          {actions.map((a) => {
            const Icon = a.icon
            return (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                >
                  <Icon className="h-4 w-4 text-[var(--text-muted)]" />
                  {a.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </details>
  )
}

