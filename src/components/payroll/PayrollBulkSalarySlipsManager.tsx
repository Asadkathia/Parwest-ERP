"use client"

import { useCallback, useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"

const EARNINGS = [
  { key: "basicSalary", label: "Basic Salary" },
  { key: "workingDays", label: "Working Days" },
  { key: "paidWorkingDays", label: "Paid Working Days" },
  { key: "overtime", label: "Overtime / Hours" },
  { key: "gazettedHolidays", label: "Gazetted Holidays" },
  { key: "gazettedHolidaysOvertimeAmount", label: "Gazetted Holidays / Overtime Amount" },
  { key: "arrears", label: "Arrears" },
] as const

const DEDUCTIONS = [
  { key: "advanceSalary", label: "Advance Salary" },
  { key: "eobi", label: "EOBI" },
  { key: "mess", label: "Mess Deduction" },
  { key: "specialBranch", label: "Special Branch" },
  { key: "apsaaTraining", label: "APSAA Training" },
  { key: "absencePenalty", label: "Absence Penalty" },
] as const

type SlipRow = {
  id: string
  month: string
  grossPay: number
  netPayable: number
  createdAt: string
  guard: { parwestId: string; name: string }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim()
    })
    return obj
  })
}

type PayrollBulkSalarySlipsManagerProps = {
  canCreate?: boolean
}

export default function PayrollBulkSalarySlipsManager({
  canCreate = false,
}: PayrollBulkSalarySlipsManagerProps = {}) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [earnings, setEarnings] = useState<Set<string>>(new Set(EARNINGS.map((e) => e.key)))
  const [deductions, setDeductions] = useState<Set<string>>(new Set(DEDUCTIONS.map((d) => d.key)))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [slips, setSlips] = useState<SlipRow[]>([])
  const [loadingSlips, setLoadingSlips] = useState(false)

  const loadSlips = useCallback(async () => {
    setLoadingSlips(true)
    const res = await fetch(`/api/payroll/salary-slips?month=${month}`)
    if (res.ok) setSlips(await res.json())
    setLoadingSlips(false)
  }, [month])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch driven by month filter via callback
    loadSlips()
  }, [loadSlips])

  const toggleSet = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setter(next)
  }
  const toggleAll = (allKeys: string[], set: Set<string>, setter: (s: Set<string>) => void) => {
    const allOn = allKeys.every((k) => set.has(k))
    setter(allOn ? new Set() : new Set(allKeys))
  }

  const handleFile = (file: File | null) => {
    if (!file) return
    setFileError(null)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== "string") {
        setFileError("Could not read file.")
        return
      }
      const rows = parseCsvRows(text)
      if (rows.length === 0) {
        setFileError("No rows found in file.")
        return
      }
      setParsedRows(rows)
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    const cols = ["parwestId", ...EARNINGS.map((e) => e.key), ...DEDUCTIONS.map((d) => d.key)]
    const csv = cols.join(",") + "\n,0,0,0,0,0,0,0,0,0,0,0,0,0\n"
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "salary-slips-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const generate = async () => {
    if (parsedRows.length === 0) {
      setFileError("Upload a file first.")
      return
    }
    setBusy(true)
    setResult(null)
    const res = await fetch("/api/payroll/salary-slips/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: `${month}-01`,
        earnings: Array.from(earnings),
        deductions: Array.from(deductions),
        rows: parsedRows,
      }),
    })
    const data = await res.json()
    setBusy(false)
    if (res.ok) {
      const failed = data.results.filter((r: { success: boolean }) => !r.success)
      setResult(
        `Generated ${data.generated}/${data.total} payslips.${failed.length > 0 ? ` ${failed.length} failed.` : ""}`
      )
      loadSlips()
    } else {
      setResult(`Error: ${data.error ?? "Failed."}`)
    }
  }

  return (
    <PayrollPageShell
      title="Payroll — Bulk Salary Slips"
      subtitle="Upload a CSV of per-guard earnings/deductions and generate payslips for the month."
    >
      <section className="ui-card p-4 space-y-4">
        <h3 className="text-base font-semibold">Upload Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 items-end">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Salary Month *
            </label>
            <input
              type="month"
              className="ui-input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <ActionButton variant="secondary" onClick={downloadTemplate}>
              Download Sample Template
            </ActionButton>
            <label className="ui-btn ui-btn-secondary px-3 py-2 text-sm cursor-pointer">
              Upload CSV
              <input
                type="file"
                className="hidden"
                accept=".csv"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {parsedRows.length > 0 && (
              <span className="text-sm text-[var(--text-muted)]">
                {parsedRows.length} rows parsed
              </span>
            )}
          </div>
        </div>
        {fileError && <p className="text-sm text-red-500">{fileError}</p>}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <CheckboxPanel
          title="Earnings"
          accent="green"
          options={EARNINGS}
          selected={earnings}
          onToggle={(k) => toggleSet(earnings, k, setEarnings)}
          onToggleAll={() =>
            toggleAll(
              EARNINGS.map((e) => e.key),
              earnings,
              setEarnings
            )
          }
        />
        <CheckboxPanel
          title="Deductions"
          accent="red"
          options={DEDUCTIONS}
          selected={deductions}
          onToggle={(k) => toggleSet(deductions, k, setDeductions)}
          onToggleAll={() =>
            toggleAll(
              DEDUCTIONS.map((d) => d.key),
              deductions,
              setDeductions
            )
          }
        />
      </div>

      <div className="flex justify-end mt-6">
        {result && <span className="self-center text-sm mr-4">{result}</span>}
        {canCreate && (
          <ActionButton onClick={generate} disabled={busy || parsedRows.length === 0}>
            {busy ? "Generating…" : "Upload & Generate Payslips"}
          </ActionButton>
        )}
      </div>

      <section className="ui-card p-4 mt-8 space-y-3">
        <h3 className="text-base font-semibold">Generated Slips — {month}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Parwest ID</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-right">Gross Pay</th>
                <th className="px-3 py-2 text-right">Net Payable</th>
                <th className="px-3 py-2 text-left">Generated</th>
              </tr>
            </thead>
            <tbody>
              {loadingSlips && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loadingSlips && slips.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No slips generated for this month.
                  </td>
                </tr>
              )}
              {slips.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-mono">{s.guard.parwestId}</td>
                  <td className="px-3 py-2">{s.guard.name}</td>
                  <td className="px-3 py-2 text-right">PKR {s.grossPay.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    PKR {s.netPayable.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PayrollPageShell>
  )
}

function CheckboxPanel({
  title,
  accent,
  options,
  selected,
  onToggle,
  onToggleAll,
}: {
  title: string
  accent: "green" | "red"
  options: ReadonlyArray<{ key: string; label: string }>
  selected: Set<string>
  onToggle: (k: string) => void
  onToggleAll: () => void
}) {
  const allOn = options.every((o) => selected.has(o.key))
  const headerClass = accent === "green" ? "bg-green-600" : "bg-red-600"
  return (
    <div className="ui-card p-0 overflow-hidden">
      <div className={`${headerClass} text-white px-4 py-2 flex items-center justify-between`}>
        <span className="font-semibold">{title}</span>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={allOn}
            onChange={onToggleAll}
            className="accent-white"
          />
          Select All
        </label>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        {options.map((o) => (
          <label key={o.key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.has(o.key)}
              onChange={() => onToggle(o.key)}
              className="accent-[var(--brand)]"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  )
}
