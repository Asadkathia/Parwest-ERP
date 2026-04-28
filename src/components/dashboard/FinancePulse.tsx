import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/shadcn/card"
import { cn } from "@/lib/utils"
import { formatShortMoney, formatPayrollState, type FinanceSnapshot } from "@/lib/dashboard/queries"

export default function FinancePulse({ data, nowMs }: { data: FinanceSnapshot; nowMs: number }) {
  const totalOutstanding = data.buckets.reduce((sum, b) => sum + b.amount, 0)
  const deltaPct =
    data.mtdPriorCollected > 0
      ? ((data.mtdCollected - data.mtdPriorCollected) / data.mtdPriorCollected) * 100
      : null

  return (
    <Card>
      <CardHeader>
        <div className="mb-4 flex items-start justify-between gap-4 text-sm font-semibold text-[var(--brand)] hover:underline"><div><h2 className="text-xl font-bold tracking-tight">{"Finance Pulse"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Month-to-date snapshot"}</p></div><div className="flex shrink-0 items-center gap-2">{(<Link href="/clients/invoicing" className="text-sm font-semibold text-[var(--brand)] hover:underline">
              Open invoicing
            </Link>)}</div></div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric
            label="A/R Outstanding"
            value={`₨ ${formatShortMoney(totalOutstanding)}`}
            sub={`${data.buckets.reduce((s, b) => s + b.count, 0)} open invoices`}
            tone="warning"
          />
          <Metric
            label="MTD Collected"
            value={`₨ ${formatShortMoney(data.mtdCollected)}`}
            sub={
              deltaPct !== null
                ? `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs last month`
                : "No prior data"
            }
            tone={deltaPct !== null && deltaPct >= 0 ? "success" : "brand"}
          />
          <Metric
            label="Payroll Cycle"
            value={formatPayrollState(data.payrollCycleState)}
            sub={data.payrollCycleMonth ? new Date(data.payrollCycleMonth).toLocaleString("en-US", { month: "long", year: "numeric" }) : "—"}
            tone={
              data.payrollCycleState === "PAID" || data.payrollCycleState === "GLOBAL_FINALIZED"
                ? "success"
                : data.payrollCycleState === "HOLD"
                ? "danger"
                : "warning"
            }
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">A/R Aging</p>
          <div className="grid grid-cols-5 gap-2">
            {data.buckets.map((b) => (
              <div
                key={b.label}
                className={cn(
                  "rounded-[var(--radius-md)] border p-3",
                  b.label === "90d+" && b.amount > 0 ? "border-red-200 bg-red-50" : "border-[var(--border)]"
                )}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{b.label}</p>
                <p className="mt-1 text-sm font-bold text-[var(--text)]">₨ {formatShortMoney(b.amount)}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{b.count} inv.</p>
              </div>
            ))}
          </div>
        </div>

        {data.topOverdue.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Top overdue invoices
            </p>
            <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-md)] border border-[var(--border)]">
              {data.topOverdue.map((inv) => {
                const daysPast = inv.dueDate
                  ? Math.floor((nowMs - new Date(inv.dueDate).getTime()) / 86_400_000)
                  : 0
                return (
                  <li key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--text)]">{inv.client}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {inv.invoiceNumber} · {daysPast}d overdue
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-red-600">
                      ₨ {formatShortMoney(inv.amount)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: "brand" | "success" | "warning" | "danger"
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold",
          tone === "success" && "text-emerald-600",
          tone === "warning" && "text-amber-600",
          tone === "danger" && "text-red-600",
          tone === "brand" && "text-[var(--text)]"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p>
    </div>
  )
}
