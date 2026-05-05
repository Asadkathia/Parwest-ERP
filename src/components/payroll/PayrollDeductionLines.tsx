"use client"

/**
 * Reusable per-payroll deduction lines viewer with override drawer.
 *
 * Reads from GET /api/payroll/[id]/deductions and writes via
 * PATCH/DELETE /api/payroll/[id]/deductions/[typeId]/override.
 *
 * Each line shows code, name, source, rate-row id, computed vs applied
 * amount, override badge + reason. Operators with PAYROLL.DEDUCTION_OVERRIDE
 * can override or clear an override per line.
 *
 * The server enforces all gates (permission + workflow rule
 * `deductions.allowOverrideOnFinalized`). Errors surface via toast.
 */

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Pencil, RotateCcw, ChevronRight } from "lucide-react"

import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table"

type Entry = {
  id: string
  deductionTypeId: string
  code: string
  name: string
  isPolicyManaged: boolean
  rateSource: string
  rateRowId: string | null
  amount: number
  computedAmount: number | null
  breakdown: unknown
  isOverride: boolean
  overrideByName: string | null
  overrideReason: string | null
  overrideAt: string | null
}

type ApiResponse = {
  payroll: { id: string; state: string }
  entries: Entry[]
}

export default function PayrollDeductionLines({ payrollId }: { payrollId: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [overrideTarget, setOverrideTarget] = useState<Entry | null>(null)
  const [breakdownTarget, setBreakdownTarget] = useState<Entry | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/payroll/${payrollId}/deductions`)
      const body = await res.json()
      if (!res.ok) throw new Error(body?.message ?? "Failed to load")
      setData((body?.data ?? body) as ApiResponse)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load deductions")
    } finally {
      setLoading(false)
    }
  }, [payrollId])

  useEffect(() => {
    void load()
  }, [load])

  async function clearOverride(entry: Entry) {
    try {
      const res = await fetch(
        `/api/payroll/${payrollId}/deductions/${entry.deductionTypeId}/override`,
        { method: "DELETE" }
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body?.message ?? "Clear failed")
      toast.success("Override cleared")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clear failed")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Deduction lines</CardTitle>
        <CardDescription className="text-xs">
          Canonical deduction entries with rate-row trace. Overrides preserve the engine&apos;s computed value
          for audit; the applied amount is what the slip uses.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : !data || data.entries.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No deduction entries on this payroll.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Computed</TableHead>
                <TableHead className="text-right">Applied</TableHead>
                <TableHead>Override</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.code}</TableCell>
                  <TableCell className="text-sm">{e.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.rateSource}
                    {e.rateRowId ? (
                      <div className="font-mono text-[10px]">{e.rateRowId.slice(-8)}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {e.computedAmount === null ? "—" : <ParwestCurrency value={e.computedAmount} />}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    <ParwestCurrency value={e.amount} />
                  </TableCell>
                  <TableCell>
                    {e.isOverride ? (
                      <div>
                        <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700">
                          Override
                        </Badge>
                        {e.overrideReason ? (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            {e.overrideReason}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBreakdownTarget(e)}
                      title="View breakdown"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <PermissionGate module="PAYROLL" action="DEDUCTION_OVERRIDE">
                      {e.isOverride ? (
                        <Button size="sm" variant="ghost" onClick={() => clearOverride(e)}>
                          <RotateCcw className="mr-1 h-3.5 w-3.5" />
                          Clear
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setOverrideTarget(e)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Override
                        </Button>
                      )}
                    </PermissionGate>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <OverrideDialog
        entry={overrideTarget}
        payrollId={payrollId}
        onClose={() => setOverrideTarget(null)}
        onSaved={load}
      />

      <BreakdownDialog
        entry={breakdownTarget}
        onClose={() => setBreakdownTarget(null)}
      />
    </Card>
  )
}

function OverrideDialog({
  entry,
  payrollId,
  onClose,
  onSaved,
}: {
  entry: Entry | null
  payrollId: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (entry) {
      setAmount(String(entry.amount))
      setReason("")
    }
  }, [entry])

  if (!entry) return null

  async function submit() {
    if (!entry) return
    if (!reason.trim()) {
      toast.error("Reason is required")
      return
    }
    const num = Number(amount)
    if (!Number.isFinite(num) || num < 0) {
      toast.error("Amount must be a non-negative number")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/payroll/${payrollId}/deductions/${entry.deductionTypeId}/override`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: num, reason: reason.trim() }),
        }
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body?.message ?? "Override failed")
      toast.success("Override applied")
      await onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Override failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override deduction line</DialogTitle>
          <DialogDescription>
            Sets a manual amount on {entry.code} ({entry.name}). The engine&apos;s computed value
            is preserved on the entry for audit. Overrides survive recompute until cleared.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded border p-3 text-xs text-muted-foreground">
            <div>
              Computed amount:{" "}
              <span className="font-medium text-foreground">
                {entry.computedAmount === null ? "—" : <ParwestCurrency value={entry.computedAmount} />}
              </span>
            </div>
            <div>
              Source: <span className="font-medium text-foreground">{entry.rateSource}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Override amount (Rs)</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reason (required)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              placeholder="e.g. management approval ref #123"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BreakdownDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  if (!entry) return null
  return (
    <Dialog open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {entry.code} — breakdown
          </DialogTitle>
          <DialogDescription>
            Source: {entry.rateSource}
            {entry.rateRowId ? ` · rate row ${entry.rateRowId.slice(-8)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-[400px] overflow-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(entry.breakdown ?? [], null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  )
}
