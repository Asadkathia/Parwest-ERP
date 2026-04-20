"use client"

import Link from "next/link"
import { useEffect, useState, use as reactUse } from "react"
import { useSearchParams } from "next/navigation"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"

type GuardRow = {
  sr: number
  guardId: string
  parwestId: string
  guardName: string
  guardType: string | null
  extraGuard: boolean
  salaryRate: number
  totalDays: number
  overtimeDays: number
  regularWage: number
  overtimeWage: number
  postAllowance: number
  grossPay: number
  loanDeduction: number
  netPayable: number
}

type BranchDetail = {
  branch: { id: string; name: string; code: string | null; clientName: string }
  month: string
  manager: { id: string; name: string } | null
  supervisor: { id: string; name: string } | null
  totalBranchSalary: number
  guards: GuardRow[]
}

export default function BranchDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: branchId } = reactUse(params)
  const searchParams = useSearchParams()
  const monthParam = searchParams.get("month") ?? new Date().toISOString().slice(0, 7)

  const [detail, setDetail] = useState<BranchDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch keyed by route/month params
    setLoading(true)
    fetch(`/api/payroll/salary-v2/branch/${branchId}?month=${monthParam}-01`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setDetail(data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [branchId, monthParam])

  const filteredGuards = detail?.guards.filter((g) => {
    if (filter) {
      const s = filter.toLowerCase()
      if (
        !g.parwestId.toLowerCase().includes(s) &&
        !g.guardName.toLowerCase().includes(s)
      )
        return false
    }
    if (typeFilter && g.guardType !== typeFilter) return false
    return true
  }) ?? []

  const exportExcel = () => {
    if (!detail) return
    const header = [
      "Sr",
      "Parwest ID",
      "Guard Name",
      "Guard Type",
      "Extra Guard",
      "Salary Rate",
      "Total Days",
      "Overtime Days",
      "Regular Wage",
      "Overtime Wage",
      "Post Allowance",
      "Gross Pay",
      "Loan Deduction",
      "Net Payable",
    ]
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [header.join(",")]
      .concat(
        filteredGuards.map((g) =>
          [
            g.sr,
            g.parwestId,
            g.guardName,
            g.guardType ?? "",
            g.extraGuard ? "Yes" : "No",
            g.salaryRate,
            g.totalDays,
            g.overtimeDays,
            g.regularWage,
            g.overtimeWage,
            g.postAllowance,
            g.grossPay,
            g.loanDeduction,
            g.netPayable,
          ]
            .map(escape)
            .join(",")
        )
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `branch-${detail.branch.code ?? detail.branch.id}-${monthParam}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PayrollPageShell
      title={
        detail
          ? `Salary Details — ${detail.branch.name}${detail.branch.clientName !== "—" ? ` (${detail.branch.clientName})` : ""}`
          : "Loading branch…"
      }
      subtitle={`Month: ${monthParam}`}
      actions={
        <Link href="/payroll/salary-v2" className="text-sm text-[var(--brand)] hover:underline">
          ← Back to Salary V2
        </Link>
      }
    >
      {loading && (
        <div className="ui-card p-8 text-center text-[var(--text-muted)]">Loading…</div>
      )}
      {!loading && !detail && (
        <div className="ui-card p-8 text-center text-red-500">Branch not found.</div>
      )}
      {detail && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="ui-card p-4 bg-green-50 border-green-200">
              <div className="text-xs text-[var(--text-muted)]">Total Branch Salary</div>
              <div className="text-xl font-bold text-green-700">
                PKR {detail.totalBranchSalary.toLocaleString()}
              </div>
            </div>
            <div className="ui-card p-4">
              <div className="text-xs text-[var(--text-muted)]">Branch Manager</div>
              <div className="font-semibold">{detail.manager?.name ?? "—"}</div>
            </div>
            <div className="ui-card p-4">
              <div className="text-xs text-[var(--text-muted)]">Branch Supervisor</div>
              <div className="font-semibold">{detail.supervisor?.name ?? "—"}</div>
            </div>
            <div className="ui-card p-4">
              <ActionButton onClick={exportExcel}>Export Excel</ActionButton>
            </div>
          </div>

          <section className="ui-card p-4 mt-6 space-y-3">
            <div className="flex gap-3 flex-wrap items-end">
              <input
                className="ui-input flex-1 min-w-[200px]"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by Parwest ID or name"
              />
              <select
                className="ui-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Civilian">Civilian</option>
                <option value="Army">Army</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] text-sm">
                <thead className="bg-[var(--surface-muted)]">
                  <tr>
                    <th className="px-3 py-2 text-left">Sr#</th>
                    <th className="px-3 py-2 text-left">Parwest ID</th>
                    <th className="px-3 py-2 text-left">Guard Name</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Extra Guard</th>
                    <th className="px-3 py-2 text-right">Salary Rate</th>
                    <th className="px-3 py-2 text-right">Total Days</th>
                    <th className="px-3 py-2 text-right">Overtime Days</th>
                    <th className="px-3 py-2 text-right">Regular Wage</th>
                    <th className="px-3 py-2 text-right">Overtime Wage</th>
                    <th className="px-3 py-2 text-right">Post Allowance</th>
                    <th className="px-3 py-2 text-right">Gross Pay</th>
                    <th className="px-3 py-2 text-right">Loan Deduction</th>
                    <th className="px-3 py-2 text-right">Net Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGuards.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-3 py-6 text-center text-[var(--text-muted)]">
                        No guards for this branch/month.
                      </td>
                    </tr>
                  )}
                  {filteredGuards.map((g) => (
                    <tr key={g.guardId} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">{g.sr}</td>
                      <td className="px-3 py-2 font-mono">{g.parwestId}</td>
                      <td className="px-3 py-2">{g.guardName}</td>
                      <td className="px-3 py-2">{g.guardType ?? ""}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            g.extraGuard
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                          }`}
                        >
                          {g.extraGuard ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">PKR {g.salaryRate.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{g.totalDays}</td>
                      <td className="px-3 py-2 text-right">{g.overtimeDays}</td>
                      <td className="px-3 py-2 text-right">
                        PKR {g.regularWage.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        PKR {g.overtimeWage.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        PKR {g.postAllowance.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">PKR {g.grossPay.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        PKR {g.loanDeduction.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        PKR {g.netPayable.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </PayrollPageShell>
  )
}
