"use client"

/**
 * Shared rate-policy manager for /settings/deductions/*.
 *
 * Drives a list (Active / Scheduled / Historical) + propose / approve /
 * supersede flow against any of the 8 rate tables, parameterized by config.
 *
 * Rates are effective-dated and immutable in place: every change is a new row.
 * Active rows have effectiveTo = NULL; superseded rows are kept for audit.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import { Badge } from "@/components/shadcn/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shadcn/tabs"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import { PermissionGate } from "@/components/shadcn/permission-gate"

export type ScopeOption = { id: string; label: string }

export type RateField =
  | { kind: "amount"; key: "amount"; label: string }
  | { kind: "number"; key: string; label: string; min?: number; defaultValue?: number }
  | { kind: "select"; key: string; label: string; options: { value: string; label: string }[]; defaultValue?: string }

export type RateTableConfig = {
  apiPath: string // e.g. "/api/deductions/cwf-region-rates"
  scope: { kind: "branch" | "region" | "global" }
  fields: RateField[]
  // Columns to render in the table for each row, beyond the common
  // (status, effectiveFrom, effectiveTo, approver, source doc).
  rowCells: { key: string; label: string; format?: (v: unknown) => string }[]
}

type RateRow = {
  id: string
  status: "DRAFT" | "ACTIVE" | "SUPERSEDED"
  amount?: number
  effectiveFrom: string
  effectiveTo: string | null
  proposedByName: string | null
  approvedByName: string | null
  proposedAt: string
  approvedAt: string | null
  sourceDocumentUrl: string | null
  notes: string | null
  branchId?: string
  regionId?: string
  // table-specific extras
  totalCost?: number
  installmentAmount?: number
  installmentCount?: number
  minMonths?: number
  maxMonths?: number
  callsPerNight?: number
  twoMissedDeduction?: number
  repeatedDayPenalty?: number
  consecutiveOneMissedWarningDay?: number
  consecutiveOneMissedDeductionDay?: number
  dayRateBasis?: string
  customDayRate?: number | null
} & Record<string, unknown>

export type RatePolicyManagerProps = {
  title: string
  description: string
  config: RateTableConfig
  scopeOptions?: ScopeOption[] // for branch/region scoped tables
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toISOString().slice(0, 10)
}

function statusBadge(status: RateRow["status"]) {
  const map: Record<RateRow["status"], { label: string; className: string }> = {
    ACTIVE: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    DRAFT: { label: "Draft", className: "bg-amber-100 text-amber-700 border-amber-300" },
    SUPERSEDED: {
      label: "Superseded",
      className: "bg-muted text-muted-foreground border-muted-foreground/20",
    },
  }
  const m = map[status]
  return (
    <Badge variant="outline" className={m.className}>
      {m.label}
    </Badge>
  )
}

export default function RatePolicyManager({
  title,
  description,
  config,
  scopeOptions,
}: RatePolicyManagerProps) {
  const [rows, setRows] = useState<RateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scopeId, setScopeId] = useState<string | null>(
    config.scope.kind === "global" ? null : (scopeOptions?.[0]?.id ?? null)
  )
  const [tab, setTab] = useState<"ACTIVE" | "SCHEDULED" | "HISTORY">("ACTIVE")
  const [proposeOpen, setProposeOpen] = useState(false)
  const [supersedeOpen, setSupersedeOpen] = useState<RateRow | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (scopeId) params.set("scopeId", scopeId)
      const res = await fetch(`${config.apiPath}?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? "Failed to load")
      setRows((data?.data ?? data) as RateRow[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load rates")
    } finally {
      setLoading(false)
    }
  }, [config.apiPath, scopeId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab === "ACTIVE") return r.status === "ACTIVE"
      if (tab === "SCHEDULED")
        return r.status === "DRAFT" || (r.status === "ACTIVE" && new Date(r.effectiveFrom) > today)
      return r.status === "SUPERSEDED"
    })
  }, [rows, tab, today])

  async function approve(id: string) {
    try {
      const res = await fetch(`${config.apiPath}/${id}/approve`, { method: "PATCH" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? "Approve failed")
      toast.success("Rate approved")
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <PermissionGate module="DEDUCTIONS" action="RATE_PROPOSE">
          <Button onClick={() => setProposeOpen(true)}>New rate</Button>
        </PermissionGate>
      </div>

      {config.scope.kind !== "global" && scopeOptions && scopeOptions.length > 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Label className="text-sm">
              {config.scope.kind === "branch" ? "Branch" : "Region"}
            </Label>
            <Select value={scopeId ?? ""} onValueChange={(v) => setScopeId(v)}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="ACTIVE">Active</TabsTrigger>
          <TabsTrigger value="SCHEDULED">Scheduled / Draft</TabsTrigger>
          <TabsTrigger value="HISTORY">Historical</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {filtered.length} {filtered.length === 1 ? "row" : "rows"}
              </CardTitle>
              <CardDescription>
                Rates are effective-dated. Activating a new rate auto-supersedes the prior active row.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No {tab.toLowerCase()} rows.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      {config.rowCells.map((c) => (
                        <TableHead key={c.key}>{c.label}</TableHead>
                      ))}
                      <TableHead>Effective</TableHead>
                      <TableHead>Approver</TableHead>
                      <TableHead>Source doc</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        {config.rowCells.map((c) => {
                          const v = r[c.key as keyof RateRow]
                          return (
                            <TableCell key={c.key}>
                              {c.format
                                ? c.format(v)
                                : typeof v === "number"
                                  ? c.key.toLowerCase().includes("amount") ||
                                    c.key === "totalCost" ||
                                    c.key === "customDayRate"
                                    ? <ParwestCurrency value={v} />
                                    : v.toString()
                                  : String(v ?? "—")}
                            </TableCell>
                          )
                        })}
                        <TableCell>
                          <div className="text-xs">
                            <div>From {fmtDate(r.effectiveFrom)}</div>
                            <div className="text-muted-foreground">
                              to {fmtDate(r.effectiveTo)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{r.approvedByName ?? "—"}</div>
                          <div className="text-muted-foreground">
                            Proposed by {r.proposedByName ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.sourceDocumentUrl ? (
                            <a
                              href={r.sourceDocumentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline"
                            >
                              link
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          {r.status === "DRAFT" && (
                            <PermissionGate module="DEDUCTIONS" action="RATE_APPROVE">
                              <Button size="sm" variant="default" onClick={() => approve(r.id)}>
                                Approve
                              </Button>
                            </PermissionGate>
                          )}
                          {r.status === "ACTIVE" && (
                            <PermissionGate module="DEDUCTIONS" action="RATE_APPROVE">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSupersedeOpen(r)}
                              >
                                Supersede
                              </Button>
                            </PermissionGate>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProposeDialog
        open={proposeOpen}
        onClose={() => setProposeOpen(false)}
        onSaved={refresh}
        config={config}
        scopeId={scopeId}
      />

      <SupersedeDialog
        row={supersedeOpen}
        onClose={() => setSupersedeOpen(null)}
        onSaved={refresh}
        apiPath={config.apiPath}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Propose dialog
// ─────────────────────────────────────────────────────────────────────────────
function ProposeDialog({
  open,
  onClose,
  onSaved,
  config,
  scopeId,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void | Promise<void>
  config: RateTableConfig
  scopeId: string | null
}) {
  const [submitting, setSubmitting] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [effectiveFrom, setEffectiveFrom] = useState("")
  const [sourceDocumentUrl, setSourceDocumentUrl] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {}
      for (const f of config.fields) {
        if (f.kind === "number" && typeof f.defaultValue === "number") {
          init[f.key] = String(f.defaultValue)
        }
        if (f.kind === "select" && f.defaultValue) init[f.key] = f.defaultValue
      }
      setValues(init)
      setEffectiveFrom("")
      setSourceDocumentUrl("")
      setNotes("")
    }
  }, [open, config.fields])

  async function submit() {
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        effectiveFrom,
        sourceDocumentUrl: sourceDocumentUrl || null,
        notes: notes || null,
      }
      if (config.scope.kind === "branch") body.branchId = scopeId
      if (config.scope.kind === "region") body.regionId = scopeId
      for (const f of config.fields) {
        const raw = values[f.key]
        if (f.kind === "select") {
          if (raw) body[f.key] = raw
        } else {
          const n = Number(raw)
          if (!Number.isFinite(n)) continue
          body[f.key] = n
        }
      }
      const res = await fetch(config.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? "Save failed")
      toast.success("Rate proposed (DRAFT)")
      await onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Propose new rate</DialogTitle>
          <DialogDescription>
            New rates start as DRAFT. A different user with DEDUCTIONS:RATE_APPROVE must approve to activate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {config.fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}</Label>
              {f.kind === "select" ? (
                <Select
                  value={values[f.key] ?? ""}
                  onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  inputMode="decimal"
                  min={f.kind === "number" ? f.min : 0}
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, [f.key]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}
          <div className="space-y-1">
            <Label>Effective from</Label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Source approval document URL</Label>
            <Input
              type="url"
              placeholder="https://…"
              value={sourceDocumentUrl}
              onChange={(e) => setSourceDocumentUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !effectiveFrom}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Propose (DRAFT)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Supersede dialog
// ─────────────────────────────────────────────────────────────────────────────
function SupersedeDialog({
  row,
  onClose,
  onSaved,
  apiPath,
}: {
  row: RateRow | null
  onClose: () => void
  onSaved: () => void | Promise<void>
  apiPath: string
}) {
  const [submitting, setSubmitting] = useState(false)
  const [effectiveTo, setEffectiveTo] = useState("")
  const [reason, setReason] = useState("")

  useEffect(() => {
    if (row) {
      setEffectiveTo("")
      setReason("")
    }
  }, [row])

  if (!row) return null

  async function submit() {
    if (!row) return
    setSubmitting(true)
    try {
      const res = await fetch(`${apiPath}/${row.id}/supersede`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effectiveTo, reason: reason || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? "Supersede failed")
      toast.success("Rate superseded")
      await onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Supersede failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supersede rate</DialogTitle>
          <DialogDescription>
            This sets effectiveTo on the active row and marks it SUPERSEDED. A new DRAFT
            row should be proposed and approved separately to take its place.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Effective to</Label>
            <Input
              type="date"
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={submitting || !effectiveTo}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Supersede
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
