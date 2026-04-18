"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import GuardAutocomplete from "@/components/payroll/shared/GuardAutocomplete"
import GuardContextFields from "@/components/payroll/shared/GuardContextFields"
import GuardInfoCard from "@/components/payroll/shared/GuardInfoCard"
import AttendanceDetailsTable from "@/components/payroll/shared/AttendanceDetailsTable"
import Base64FileUpload from "@/components/payroll/shared/Base64FileUpload"
import type { GuardCurrentContext } from "@/lib/guards/currentContext"
import { parseCsvToLoanRows, type BulkLoanDraftRow } from "@/lib/payroll/loans-bulk"

type TabId = "add" | "finalize" | "history"

type LoanRow = {
  id: string
  amount: number
  status: string
  paymentMethod: string | null
  slipNumber: string | null
  bankName: string | null
  accountNumber: string | null
  paymentDate: string | null
  supervisor: string | null
  manager: string | null
  createdAt: string
  finalizedAt: string | null
  month: string
  regionId?: string | null
  guard: { parwestId: string; name: string; phone?: string | null; regionId?: string | null }
}

type Region = { id: string; name: string }
type Client = { id: string; name: string }
type Branch = { id: string; name: string; clientId: string }
type Supervisor = { id: string; name: string }
type HistoryRow = {
  id: string
  finalizedAt: string
  finalizedByName: string
  regionName: string | null
  month: string
  loanCount: number
  totalAmount: number
}

const PAYMENT_METHODS = ["BANK", "CASH", "MOBILE"]

export default function LoansPage() {
  const [activeTab, setActiveTab] = useState<TabId>("add")

  return (
    <PayrollPageShell
      title="Payroll — Loans"
      subtitle="Add loans, finalize bank-confirmed batches, and export finalised history."
      tabs={[
        { id: "add", label: "Add Loans" },
        { id: "finalize", label: "Finalize Loans" },
        { id: "history", label: "Export Finalised History" },
      ]}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as TabId)}
    >
      {activeTab === "add" && <AddLoansTab />}
      {activeTab === "finalize" && <FinalizeLoansTab />}
      {activeTab === "history" && <HistoryTab />}
    </PayrollPageShell>
  )
}

// ───────────────────────────── ADD LOANS TAB ─────────────────────────────

function AddLoansTab() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [parwestIdInput, setParwestIdInput] = useState("")
  const [context, setContext] = useState<GuardCurrentContext | null>(null)
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState("")
  const [selectClientId, setSelectClientId] = useState("")
  const [selectBranchId, setSelectBranchId] = useState("")
  const [slipNumber, setSlipNumber] = useState("")
  const [supervisorUserId, setSupervisorUserId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<string | null>(null)

  const [bulkRows, setBulkRows] = useState<BulkLoanDraftRow[]>([])
  const [bulkCommitting, setBulkCommitting] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.clients ?? data.rows ?? []
        setClients(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      })
      .catch(() => {})
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.users ?? data.rows ?? []
        setSupervisors(
          list
            .filter((u: { role?: { name?: string } }) => u.role?.name?.toLowerCase().includes("supervisor"))
            .map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))
        )
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectClientId) {
      setBranches([])
      return
    }
    fetch(`/api/branches?clientId=${selectClientId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.branches ?? data.rows ?? []
        setBranches(
          list.map((b: { id: string; name: string; clientId: string }) => ({
            id: b.id,
            name: b.name,
            clientId: b.clientId,
          }))
        )
      })
      .catch(() => {})
  }, [selectClientId])

  const loadContext = useCallback(
    async (guardIdOrParwest: string) => {
      if (!guardIdOrParwest) return
      const res = await fetch(
        `/api/guards/${encodeURIComponent(guardIdOrParwest)}/current-context?month=${month}`
      )
      if (res.ok) {
        const ctx = (await res.json()) as GuardCurrentContext
        setContext(ctx)
      } else {
        setContext(null)
      }
    },
    [month]
  )

  useEffect(() => {
    if (context) loadContext(context.guardId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const handleGuardSelect = (opt: { id: string; parwestId: string }) => {
    setParwestIdInput(opt.parwestId)
    loadContext(opt.id)
  }

  const payableAmount = useMemo(() => context?.currentUnpaidLoan ?? 0, [context])

  const canSubmit = Boolean(
    context && amount && Number(amount) > 0 && paymentDate && paymentMethod && slipNumber
  )

  const submit = async () => {
    if (!context) return
    setSaving(true)
    setSaveResult(null)
    try {
      const res = await fetch("/api/payroll/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: context.guardId,
          month: `${month}-01`,
          amount: Number(amount),
          deploymentDays: context.deploymentDays,
          supervisor: context.currentSupervisor?.name ?? null,
          manager: context.currentManager?.name ?? null,
          supervisorUserId: supervisorUserId || context.currentSupervisor?.id || null,
          managerUserId: context.currentManager?.id ?? null,
          clientId: selectClientId || null,
          branchId: selectBranchId || null,
          slipNumber,
          paymentDate,
          paymentMethod,
          imageBase64,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaveResult(`Loan saved for ${context.name}.`)
        setAmount("")
        setSlipNumber("")
        setPaymentDate("")
        setPaymentMethod("")
        setImageBase64(null)
        loadContext(context.guardId)
      } else {
        setSaveResult(`Error: ${data.error ?? "Failed to save."}`)
      }
    } catch {
      setSaveResult("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleBulkUpload = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== "string") return
      setBulkRows(parseCsvToLoanRows(text))
      setBulkResult(null)
    }
    reader.readAsText(file)
  }

  const commitBulk = async () => {
    const ready = bulkRows.filter((r) => r.status === "READY" && r.guardId)
    if (ready.length === 0) return
    setBulkCommitting(true)
    try {
      const res = await fetch("/api/payroll/loans/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: ready.map((r) => ({
            guardId: r.guardId,
            amount: r.amount,
            loanDate: r.loanDate,
            notes: r.notes,
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setBulkResult(`Committed ${data.committed}/${data.total} loans.`)
        setBulkRows((prev) =>
          prev.map((r) => (r.status === "READY" ? { ...r, status: "COMMITTED" } : r))
        )
      } else {
        setBulkResult(`Error: ${data.error ?? "Bulk commit failed."}`)
      }
    } catch {
      setBulkResult("Network error.")
    } finally {
      setBulkCommitting(false)
    }
  }

  const downloadTemplate = () => {
    const csv = "guardId,amount,loanDate,notes\n,0,2026-04-01,\n"
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bulk-loans-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        <section className="ui-card p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Month *
              </label>
              <input
                type="month"
                className="ui-input"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Parwest ID *
              </label>
              <GuardAutocomplete
                value={parwestIdInput}
                onChange={setParwestIdInput}
                onSelect={handleGuardSelect}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Payable Amount
              </label>
              <input className="ui-input bg-cyan-50" value={payableAmount.toFixed(0)} readOnly />
            </div>
          </div>

          <GuardContextFields
            context={context}
            showRows={[
              "name",
              "phone",
              "client",
              "branch",
              "days",
              "doubleDuty",
              "supervisor",
              "manager",
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Amount Paid *
              </label>
              <input
                type="number"
                className="ui-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Date of Payment *
              </label>
              <input
                type="date"
                className="ui-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Slip Number *
              </label>
              <input
                className="ui-input"
                value={slipNumber}
                onChange={(e) => setSlipNumber(e.target.value)}
                placeholder="Loan slip number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Select Client
              </label>
              <select
                className="ui-select"
                value={selectClientId}
                onChange={(e) => {
                  setSelectClientId(e.target.value)
                  setSelectBranchId("")
                }}
              >
                <option value="">--Select Client--</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Select Branch
              </label>
              <select
                className="ui-select"
                value={selectBranchId}
                onChange={(e) => setSelectBranchId(e.target.value)}
                disabled={!selectClientId}
              >
                <option value="">--Select Branch--</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Supervisor
              </label>
              <select
                className="ui-select"
                value={supervisorUserId}
                onChange={(e) => setSupervisorUserId(e.target.value)}
              >
                <option value="">
                  {context?.currentSupervisor
                    ? `Default — ${context.currentSupervisor.name}`
                    : "--Select supervisor--"}
                </option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Payment Method *
              </label>
              <select
                className="ui-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="">Select Payment Method</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Upload Image
              </label>
              <Base64FileUpload
                value={imageBase64}
                onChange={setImageBase64}
                accept="image/*"
                label="Choose File"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveResult && <span className="text-sm">{saveResult}</span>}
            <div className="ml-auto">
              <ActionButton onClick={submit} disabled={!canSubmit || saving}>
                {saving ? "Saving…" : "Save"}
              </ActionButton>
            </div>
          </div>
        </section>

        <AttendanceDetailsTable
          guardId={context?.guardId ?? null}
          month={month}
          totalLoanPaid={0}
          payableLoan={payableAmount}
        />

        <section className="ui-card p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base font-semibold">Bulk Upload</h3>
            <div className="flex gap-2 flex-wrap">
              <ActionButton variant="secondary" onClick={downloadTemplate}>
                Download Template
              </ActionButton>
              <label className="ui-btn ui-btn-secondary px-3 py-2 text-sm cursor-pointer">
                Upload CSV
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={(e) => handleBulkUpload(e.target.files?.[0] || null)}
                />
              </label>
              <ActionButton
                onClick={commitBulk}
                disabled={bulkCommitting || bulkRows.length === 0}
              >
                {bulkCommitting ? "Committing…" : "Commit Batch"}
              </ActionButton>
            </div>
          </div>
          {bulkResult && <p className="text-sm">{bulkResult}</p>}
          {bulkRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-[var(--surface-muted)]">
                  <tr>
                    <th className="px-3 py-2 text-left">Guard ID</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Notes</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-t border-[var(--border)] ${r.status === "ERROR" ? "bg-red-50" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono">
                        {r.guardId || <span className="text-red-500">missing</span>}
                      </td>
                      <td className="px-3 py-2">{r.amount}</td>
                      <td className="px-3 py-2">{r.loanDate}</td>
                      <td className="px-3 py-2">{r.notes}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            r.status === "COMMITTED"
                              ? "text-green-600 font-medium"
                              : r.status === "ERROR"
                                ? "text-red-500"
                                : "text-[var(--text-muted)]"
                          }
                        >
                          {r.status}
                          {r.error ? ` — ${r.error}` : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div>
        <GuardInfoCard context={context} />
      </div>
    </div>
  )
}

// ─────────────────────────── FINALIZE LOANS TAB ───────────────────────────

function FinalizeLoansTab() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [regionId, setRegionId] = useState("")
  const [regions, setRegions] = useState<Region[]>([])
  const [rows, setRows] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/api/regions")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRegions(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const loadLoans = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("month", `${month}-01`)
    if (search) params.set("search", search)
    const res = await fetch(`/api/payroll/loans?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      let list: LoanRow[] = Array.isArray(data) ? data : []
      if (regionId) {
        list = list.filter(
          (l) => l.regionId === regionId || l.guard?.regionId === regionId
        )
      }
      setRows(list)
    }
    setLoading(false)
  }, [month, regionId, search])

  useEffect(() => {
    loadLoans()
  }, [loadLoans])

  const finalizeAll = async () => {
    if (!confirm(`Finalize all PENDING loans for ${month}${regionId ? " in selected region" : ""}?`))
      return
    setBusy(true)
    setResult(null)
    const res = await fetch("/api/payroll/loans/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: `${month}-01`, regionId: regionId || null }),
    })
    const data = await res.json()
    setResult(
      res.ok
        ? `Finalized ${data.finalized} loans. Total: ${data.totalAmount?.toFixed(0) ?? 0}`
        : `Error: ${data.error ?? "Failed."}`
    )
    setBusy(false)
    loadLoans()
  }

  const undoFinalize = async () => {
    if (!confirm(`Revert all FINALIZED loans for ${month} back to PENDING?`)) return
    setBusy(true)
    setResult(null)
    const res = await fetch("/api/payroll/loans/unfinalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: `${month}-01`, regionId: regionId || null }),
    })
    const data = await res.json()
    setResult(res.ok ? `Reverted ${data.reverted} loans.` : `Error: ${data.error ?? "Failed."}`)
    setBusy(false)
    loadLoans()
  }

  const exportAll = () => {
    const header = [
      "Payment Month",
      "Secure Ops ID",
      "Name",
      "Phone",
      "Current Supervisor",
      "Amount",
      "Date of Payment",
      "Payment Method",
      "Bank Name",
      "Account Number",
      "Supervisor",
      "Slip Number",
      "Status",
      "Created At",
    ]
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [header.map(escape).join(",")]
      .concat(
        rows.map((r) =>
          [
            new Date(r.month).toISOString().slice(0, 7),
            r.guard.parwestId,
            r.guard.name,
            r.guard.phone ?? "",
            r.supervisor ?? "",
            r.amount,
            r.paymentDate?.slice(0, 10) ?? "",
            r.paymentMethod ?? "",
            r.bankName ?? "",
            r.accountNumber ?? "",
            r.supervisor ?? "",
            r.slipNumber ?? "",
            r.status,
            r.createdAt.slice(0, 19).replace("T", " "),
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
    a.download = `loans-${month}${regionId ? `-${regionId}` : ""}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="ui-card p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[200px_200px_1fr_auto_auto_auto] gap-3 items-end">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
            Month
          </label>
          <input
            type="month"
            className="ui-input"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
            Region
          </label>
          <select className="ui-select" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            <option value="">All</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
            Search
          </label>
          <input
            className="ui-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or Parwest ID"
          />
        </div>
        <ActionButton onClick={finalizeAll} disabled={busy}>
          Finalize All
        </ActionButton>
        <ActionButton variant="secondary" onClick={undoFinalize} disabled={busy}>
          Undo Finalize
        </ActionButton>
        <ActionButton variant="secondary" onClick={exportAll}>
          Export All
        </ActionButton>
      </div>
      {result && <p className="text-sm">{result}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-3 py-2 text-left">Payment Month</th>
              <th className="px-3 py-2 text-left">Secure Ops ID</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Current Supervisor</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">Bank</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Slip</th>
              <th className="px-3 py-2 text-left">Created At</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  No loans for this month/region.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">{r.month.slice(0, 7)}</td>
                <td className="px-3 py-2 font-mono">{r.guard.parwestId}</td>
                <td className="px-3 py-2">{r.guard.name}</td>
                <td className="px-3 py-2">{r.guard.phone ?? ""}</td>
                <td className="px-3 py-2">{r.supervisor ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.amount}</td>
                <td className="px-3 py-2">{r.paymentDate?.slice(0, 10) ?? ""}</td>
                <td className="px-3 py-2">{r.paymentMethod ?? ""}</td>
                <td className="px-3 py-2">{r.bankName ?? ""}</td>
                <td className="px-3 py-2">{r.accountNumber ?? ""}</td>
                <td className="px-3 py-2">{r.slipNumber ?? ""}</td>
                <td className="px-3 py-2 text-xs">{r.createdAt.slice(0, 10)}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      r.status === "FINALIZED"
                        ? "text-green-600 font-medium"
                        : "text-[var(--text-muted)]"
                    }
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─────────────────────────── HISTORY TAB ───────────────────────────

function HistoryTab() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch("/api/payroll/loans/finalize-history")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="ui-card p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-3 py-2 text-left">Dated</th>
              <th className="px-3 py-2 text-left">Month</th>
              <th className="px-3 py-2 text-left">Region</th>
              <th className="px-3 py-2 text-right">Loans</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Finalised By</th>
              <th className="px-3 py-2 text-left">Download</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  No finalization history yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">{new Date(r.finalizedAt).toLocaleString()}</td>
                <td className="px-3 py-2">{r.month.slice(0, 7)}</td>
                <td className="px-3 py-2">{r.regionName ?? "All"}</td>
                <td className="px-3 py-2 text-right">{r.loanCount}</td>
                <td className="px-3 py-2 text-right">{r.totalAmount.toFixed(0)}</td>
                <td className="px-3 py-2">{r.finalizedByName}</td>
                <td className="px-3 py-2">
                  <a
                    href={`/api/payroll/loans/finalize-history/${r.id}/download`}
                    className="text-[var(--brand)] underline"
                  >
                    Download Report
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
