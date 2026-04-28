/**
 * Parwest ERP — Payroll: Bulk Salary Slips (canonical reskin)
 * ───────────────────────────────────────────────────────────
 * Reskinned to match the canonical payroll-loans template:
 *  - Generated slips list → `<DataTable>` with `<ParwestCurrency>`
 *  - Settings + earnings/deductions toggles in shadcn `<Card>` panels
 *  - Permission gates around Generate button
 *  - AlertDialog confirm before generating (destructive against existing
 *    slips for the same month → mirrors legacy server-side overwrite)
 *  - Toasts via sonner reading `data.message`
 *
 * Behaviour, API endpoints, and URL contract are preserved exactly. The
 * upload + generate flow is a single-step batch (not a wizard), so we
 * keep that shape and only reskin the surrounding shell.
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/shadcn/alert-dialog"
import { Button, buttonVariants } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { Checkbox } from "@/components/shadcn/checkbox"
import { DataTable } from "@/components/shadcn/data-table"
import { Input } from "@/components/shadcn/input"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import { PermissionGate } from "@/components/shadcn/permission-gate"

import { cn } from "@/lib/utils"
import {
  PAYROLL_SALARY_SLIP_DEDUCTIONS,
  PAYROLL_SALARY_SLIP_EARNINGS,
  payrollBulkSalarySlipGenerateSchema,
} from "@/lib/schemas/payroll-bulk-salary-slip"

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

type Region = { id: string; name: string }

type PayrollBulkSalarySlipsManagerProps = {
  canCreate?: boolean
  effectiveRegionId?: string | null
  regions?: Region[]
  locked?: boolean
}

export default function PayrollBulkSalarySlipsManager({
  canCreate = false,
  effectiveRegionId = null,
  regions = [],
  locked = false,
}: PayrollBulkSalarySlipsManagerProps = {}) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [earnings, setEarnings] = useState<Set<string>>(
    new Set(PAYROLL_SALARY_SLIP_EARNINGS.map((e) => e.key))
  )
  const [deductions, setDeductions] = useState<Set<string>>(
    new Set(PAYROLL_SALARY_SLIP_DEDUCTIONS.map((d) => d.key))
  )
  const [busy, setBusy] = useState(false)
  const [slips, setSlips] = useState<SlipRow[]>([])
  const [loadingSlips, setLoadingSlips] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)

  const loadSlips = useCallback(async () => {
    setLoadingSlips(true)
    const params = new URLSearchParams()
    params.set("month", month)
    if (effectiveRegionId) params.set("regionId", effectiveRegionId)
    const res = await fetch(`/api/payroll/salary-slips?${params.toString()}`)
    if (res.ok) setSlips(await res.json())
    setLoadingSlips(false)
  }, [month, effectiveRegionId])

  useEffect(() => {
    loadSlips()
  }, [loadSlips])

  const toggleSet = (
    set: Set<string>,
    key: string,
    setter: (s: Set<string>) => void
  ) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setter(next)
  }
  const toggleAll = (
    allKeys: string[],
    set: Set<string>,
    setter: (s: Set<string>) => void
  ) => {
    const allOn = allKeys.every((k) => set.has(k))
    setter(allOn ? new Set() : new Set(allKeys))
  }

  const handleFile = (file: File | null) => {
    if (!file) return
    setFileError(null)
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
    const cols = [
      "parwestId",
      ...PAYROLL_SALARY_SLIP_EARNINGS.map((e) => e.key),
      ...PAYROLL_SALARY_SLIP_DEDUCTIONS.map((d) => d.key),
    ]
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
    const parsed = payrollBulkSalarySlipGenerateSchema.safeParse({
      month,
      earnings: Array.from(earnings),
      deductions: Array.from(deductions),
      rows: parsedRows,
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Invalid input."
      toast.error(first)
      setFileError(first)
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/payroll/salary-slips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: `${parsed.data.month}-01`,
          earnings: parsed.data.earnings,
          deductions: parsed.data.deductions,
          rows: parsed.data.rows,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const failed = (data.results ?? []).filter(
          (r: { success: boolean }) => !r.success
        )
        toast.success(
          `Generated ${data.generated}/${data.total} payslips.${
            failed.length > 0 ? ` ${failed.length} failed.` : ""
          }`
        )
        loadSlips()
      } else {
        toast.error(data?.message ?? "Failed to generate payslips.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setBusy(false)
      setGenerateOpen(false)
    }
  }

  const columns = useMemo<ColumnDef<SlipRow>[]>(
    () => [
      {
        id: "parwestId",
        accessorFn: (r) => r.guard.parwestId,
        header: "Parwest ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.guard.parwestId}
          </span>
        ),
      },
      {
        id: "guardName",
        accessorFn: (r) => r.guard.name,
        header: "Name",
        cell: ({ row }) => row.original.guard.name,
      },
      {
        id: "grossPay",
        accessorFn: (r) => r.grossPay,
        header: () => <span className="block text-end">Gross Pay</span>,
        cell: ({ row }) => (
          <div className="text-end">
            <ParwestCurrency value={Number(row.original.grossPay)} />
          </div>
        ),
      },
      {
        id: "netPayable",
        accessorFn: (r) => r.netPayable,
        header: () => <span className="block text-end">Net Payable</span>,
        cell: ({ row }) => (
          <div className="text-end font-semibold">
            <ParwestCurrency value={Number(row.original.netPayable)} />
          </div>
        ),
      },
      {
        id: "createdAt",
        accessorFn: (r) => r.createdAt,
        header: "Generated",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleString()}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <PayrollPageShell
      title="Payroll — Bulk Salary Slips"
      subtitle="Upload a CSV of per-guard earnings/deductions and generate payslips for the month."
    >
      <Card>
        <CardContent className="space-y-4 p-4">
          <h3 className="text-base font-semibold">Upload Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-[200px_200px_1fr] gap-4 items-end">
            <div>
              <RegionUrlPicker
                regions={regions}
                locked={locked}
                includeGlobalOption={!locked}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Salary Month *
              </label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <Button variant="outline" onClick={downloadTemplate}>
                Download Sample Template
              </Button>
              <label
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "cursor-pointer"
                )}
              >
                Upload CSV
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {parsedRows.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {parsedRows.length} rows parsed
                </span>
              )}
            </div>
          </div>
          {fileError && (
            <p className="text-sm text-destructive">{fileError}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <CheckboxPanel
          title="Earnings"
          accent="green"
          options={PAYROLL_SALARY_SLIP_EARNINGS}
          selected={earnings}
          onToggle={(k) => toggleSet(earnings, k, setEarnings)}
          onToggleAll={() =>
            toggleAll(
              PAYROLL_SALARY_SLIP_EARNINGS.map((e) => e.key),
              earnings,
              setEarnings
            )
          }
        />
        <CheckboxPanel
          title="Deductions"
          accent="red"
          options={PAYROLL_SALARY_SLIP_DEDUCTIONS}
          selected={deductions}
          onToggle={(k) => toggleSet(deductions, k, setDeductions)}
          onToggleAll={() =>
            toggleAll(
              PAYROLL_SALARY_SLIP_DEDUCTIONS.map((d) => d.key),
              deductions,
              setDeductions
            )
          }
        />
      </div>

      <div className="flex justify-end mt-6">
        {canCreate && (
          <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
            <AlertDialog open={generateOpen} onOpenChange={setGenerateOpen}>
              <AlertDialogTrigger asChild>
                <Button disabled={busy || parsedRows.length === 0}>
                  {busy ? "Generating…" : "Upload & Generate Payslips"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Generate payslips for {month}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {parsedRows.length} guard row
                    {parsedRows.length !== 1 ? "s" : ""} will be processed. This
                    will overwrite any existing slips for matching guards in
                    this month.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={busy}>
                    Keep open
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className={cn(buttonVariants({ variant: "destructive" }))}
                    onClick={(e) => {
                      e.preventDefault()
                      void generate()
                    }}
                    disabled={busy}
                  >
                    {busy ? "Generating…" : "Generate"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        )}
      </div>

      <Card className="mt-8">
        <CardContent className="space-y-3 p-4">
          <h3 className="text-base font-semibold">Generated Slips — {month}</h3>

          {loadingSlips ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : slips.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <div className="text-base font-semibold">No slips yet</div>
              <p className="max-w-md text-sm text-muted-foreground">
                No slips generated for this month. Upload a CSV and click
                Generate to create payslips.
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={slips}
              searchKey="guardName"
              searchPlaceholder="Filter visible rows by name…"
              pageSize={25}
              emptyMessage="No payslips match the on-page filter."
            />
          )}
        </CardContent>
      </Card>
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
    <Card className="overflow-hidden p-0">
      <div
        className={cn(
          headerClass,
          "text-white px-4 py-2 flex items-center justify-between"
        )}
      >
        <span className="font-semibold">{title}</span>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={allOn}
            onCheckedChange={() => onToggleAll()}
            className="border-white data-[state=checked]:bg-white data-[state=checked]:text-foreground"
          />
          Select All
        </label>
      </div>
      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        {options.map((o) => (
          <label
            key={o.key}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <Checkbox
              checked={selected.has(o.key)}
              onCheckedChange={() => onToggle(o.key)}
            />
            {o.label}
          </label>
        ))}
      </CardContent>
    </Card>
  )
}
