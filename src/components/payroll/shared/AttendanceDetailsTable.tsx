"use client"

import { useEffect, useState } from "react"

type AttendanceRow = {
  branchName: string
  salaryRate: number
  regularDays: number
  regularTotal: number
  overtimeRate: number
  overtimeDays: number
  overtimeTotal: number
}

type Props = {
  guardId: string | null
  month: string | null // YYYY-MM or YYYY-MM-DD
  totalLoanPaid?: number
  payableLoan?: number
}

function monthLabel(month: string | null) {
  if (!month) return ""
  const norm = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month
  const d = new Date(norm)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 7)
}

export default function AttendanceDetailsTable({
  guardId,
  month,
  totalLoanPaid = 0,
  payableLoan = 0,
}: Props) {
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!guardId || !month) {
      setRows([])
      return
    }
    setLoading(true)
    fetch(`/api/payroll/guard-attendance?guardId=${guardId}&month=${monthLabel(month)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setRows(Array.isArray(data) ? data : data.rows ?? [])
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [guardId, month])

  const totals = rows.reduce(
    (acc, r) => {
      acc.regularDays += r.regularDays
      acc.regularTotal += r.regularTotal
      acc.overtimeDays += r.overtimeDays
      acc.overtimeTotal += r.overtimeTotal
      return acc
    },
    { regularDays: 0, regularTotal: 0, overtimeDays: 0, overtimeTotal: 0 }
  )
  const grossSalary = totals.regularTotal + totals.overtimeTotal

  return (
    <div className="ui-card p-0 overflow-x-auto">
      <div className="px-4 py-2 font-semibold text-sm border-b border-[var(--border)]">
        Attendance Details month of {monthLabel(month) || "—"}
      </div>
      <table className="w-full min-w-[800px] text-sm">
        <thead className="bg-green-100 text-green-900">
          <tr>
            <th className="px-3 py-2 text-left">Branch Name</th>
            <th className="px-3 py-2 text-right">Salary Rate</th>
            <th className="px-3 py-2 text-right">Regular Days</th>
            <th className="px-3 py-2 text-right">Regular Total Salary</th>
            <th className="px-3 py-2 text-right">Overtime Salary Rate</th>
            <th className="px-3 py-2 text-right">Overtime Days</th>
            <th className="px-3 py-2 text-right">Overtime Total Salary</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7} className="px-3 py-3 text-center text-[var(--text-muted)]">
                Loading…
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-3 text-center text-[var(--text-muted)]">
                No attendance data for this guard/month.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--border)]">
              <td className="px-3 py-2">{r.branchName}</td>
              <td className="px-3 py-2 text-right">{r.salaryRate.toFixed(0)}</td>
              <td className="px-3 py-2 text-right">{r.regularDays}</td>
              <td className="px-3 py-2 text-right">{r.regularTotal.toFixed(0)}</td>
              <td className="px-3 py-2 text-right">{r.overtimeRate.toFixed(0)}</td>
              <td className="px-3 py-2 text-right">{r.overtimeDays}</td>
              <td className="px-3 py-2 text-right">{r.overtimeTotal.toFixed(0)}</td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="border-t-2 border-[var(--border)] font-semibold bg-[var(--surface-muted)]">
              <td className="px-3 py-2">TOTAL:</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right">{totals.regularDays}</td>
              <td className="px-3 py-2 text-right">{totals.regularTotal.toFixed(0)}</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right">{totals.overtimeDays}</td>
              <td className="px-3 py-2 text-right">{totals.overtimeTotal.toFixed(0)}</td>
            </tr>
          )}
        </tbody>
      </table>
      {rows.length > 0 && (
        <div className="grid grid-cols-3 border-t border-[var(--border)]">
          <div className="px-4 py-2 text-sm">
            <span className="text-[var(--text-muted)]">Total Gross Salary: </span>
            <span className="font-semibold">{grossSalary.toFixed(0)}</span>
          </div>
          <div className="px-4 py-2 text-sm">
            <span className="text-[var(--text-muted)]">Total Loan Paid: </span>
            <span className="font-semibold">{totalLoanPaid.toFixed(0)}</span>
          </div>
          <div className="px-4 py-2 text-sm bg-cyan-50 text-cyan-900">
            <span>Payable Loan: </span>
            <span className="font-semibold">{payableLoan.toFixed(0)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
