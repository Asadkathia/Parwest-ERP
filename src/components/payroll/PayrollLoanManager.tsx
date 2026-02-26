"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type GuardOption = {
  id: string
  name: string
  parwestId: string
}

type LoanRow = {
  id: string
  guardId: string
  month: string
  amount: number
  status: string
  deploymentDays: number | null
  supervisor: string | null
  manager: string | null
  createdAt: string
  guard: {
    id: string
    name: string
    parwestId: string
  }
}

const STATUS_OPTIONS = ["PENDING", "FINALIZED"]

export default function PayrollLoanManager() {
  const [guards, setGuards] = useState<GuardOption[]>([])
  const [rows, setRows] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const [filters, setFilters] = useState({
    status: "",
    guardId: "",
    month: "",
    search: "",
  })

  const [form, setForm] = useState({
    guardId: "",
    month: "",
    amount: "",
    deploymentDays: "",
    supervisor: "",
    manager: "",
    status: "PENDING",
  })

  const fetchGuards = useCallback(async () => {
    const response = await fetch("/api/guards?status=ACTIVE")
    if (!response.ok) throw new Error("Failed to load guards")
    const data = await response.json()
    setGuards(
      (data || []).map((guard: any) => ({
        id: guard.id,
        name: guard.name,
        parwestId: guard.parwestId,
      }))
    )
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set("status", filters.status)
      if (filters.guardId) params.set("guardId", filters.guardId)
      if (filters.month) params.set("month", filters.month)
      if (filters.search) params.set("search", filters.search)
      const response = await fetch(`/api/payroll/loans?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to load loans")
      const data = await response.json()
      setRows(data || [])
    } catch (error) {
      console.error(error)
      setNotice({ type: "error", message: "Unable to fetch loans." })
    } finally {
      setLoading(false)
    }
  }, [filters.guardId, filters.month, filters.search, filters.status])

  useEffect(() => {
    fetchGuards().catch((error) => {
      console.error(error)
      setNotice({ type: "error", message: "Unable to fetch guard options." })
    })
  }, [fetchGuards])

  useEffect(() => {
    fetchRows().catch((error) => {
      console.error(error)
      setNotice({ type: "error", message: "Unable to fetch loans." })
    })
  }, [fetchRows])

  const onCreate = async () => {
    if (!form.guardId || !form.month || !form.amount) {
      setNotice({ type: "error", message: "Guard, month and amount are required." })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch("/api/payroll/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: form.guardId,
          month: form.month,
          amount: Number(form.amount),
          deploymentDays: form.deploymentDays ? Number(form.deploymentDays) : null,
          supervisor: form.supervisor || null,
          manager: form.manager || null,
          status: form.status,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || "Failed to create loan")
      }

      setNotice({ type: "success", message: "Loan created." })
      setForm({
        guardId: "",
        month: "",
        amount: "",
        deploymentDays: "",
        supervisor: "",
        manager: "",
        status: "PENDING",
      })
      await fetchRows()
    } catch (error: any) {
      setNotice({ type: "error", message: error?.message || "Failed to create loan." })
    } finally {
      setSaving(false)
    }
  }

  const onFinalize = async (row: LoanRow) => {
    try {
      const response = await fetch(`/api/payroll/loans/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FINALIZED" }),
      })
      if (!response.ok) throw new Error("Failed to finalize loan")
      setNotice({ type: "success", message: `Loan finalized for ${row.guard.name}.` })
      await fetchRows()
    } catch (error) {
      console.error(error)
      setNotice({ type: "error", message: "Unable to finalize loan." })
    }
  }

  const visibleRows = useMemo(() => rows, [rows])

  return (
    <div className="space-y-6">
      <SectionTitle title="Loan" subtitle="Backend-connected loan operations." />

      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4 space-y-4">
        <p className="text-sm font-semibold text-[var(--text)]">Create Loan</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Guard *</span>
            <select
              className="ui-select"
              value={form.guardId}
              onChange={(e) => setForm((prev) => ({ ...prev, guardId: e.target.value }))}
            >
              <option value="">-- Select Guard --</option>
              {guards.map((guard) => (
                <option key={guard.id} value={guard.id}>
                  {guard.parwestId} - {guard.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Month *</span>
            <input
              className="ui-input"
              type="date"
              value={form.month}
              onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Amount *</span>
            <input
              className="ui-input"
              type="number"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Deployment Days</span>
            <input
              className="ui-input"
              type="number"
              value={form.deploymentDays}
              onChange={(e) => setForm((prev) => ({ ...prev, deploymentDays: e.target.value }))}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Supervisor</span>
            <input
              className="ui-input"
              value={form.supervisor}
              onChange={(e) => setForm((prev) => ({ ...prev, supervisor: e.target.value }))}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Manager</span>
            <input
              className="ui-input"
              value={form.manager}
              onChange={(e) => setForm((prev) => ({ ...prev, manager: e.target.value }))}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Status</span>
            <select
              className="ui-select"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end">
          <ActionButton onClick={onCreate} disabled={saving}>
            {saving ? "Saving..." : "Submit"}
          </ActionButton>
        </div>
      </section>

      <section className="ui-card p-4 space-y-4">
        <p className="text-sm font-semibold text-[var(--text)]">Filters</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Search</span>
            <input
              className="ui-input"
              value={filters.search}
              placeholder="Guard name or Parwest ID"
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Status</span>
            <select
              className="ui-select"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Guard</span>
            <select
              className="ui-select"
              value={filters.guardId}
              onChange={(e) => setFilters((prev) => ({ ...prev, guardId: e.target.value }))}
            >
              <option value="">All</option>
              {guards.map((guard) => (
                <option key={guard.id} value={guard.id}>
                  {guard.parwestId} - {guard.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Month</span>
            <input
              className="ui-input"
              type="date"
              value={filters.month}
              onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[960px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Guard</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Month</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Amount</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Supervisor</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Manager</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                  Loading loans...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                  No loan records found.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm">
                    {row.guard?.parwestId || "—"} - {row.guard?.name || "Unknown Guard"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(row.month).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-4 py-3 text-sm">{row.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{row.status}</td>
                  <td className="px-4 py-3 text-sm">{row.supervisor || "—"}</td>
                  <td className="px-4 py-3 text-sm">{row.manager || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {row.status !== "FINALIZED" ? (
                      <ActionButton variant="secondary" onClick={() => onFinalize(row)}>
                        Finalize
                      </ActionButton>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Finalized</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
