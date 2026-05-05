"use client"

/**
 * Statutory enrollment tab — EOBI + ESSI per-guard registration.
 *
 * Wires:
 *   GET / PUT /api/deductions/enrollments/eobi/[guardId]
 *   GET / PUT /api/deductions/enrollments/essi/[guardId]
 *
 * Edits are gated by DEDUCTIONS:UPDATE on the server; this UI surfaces the
 * editor unconditionally and lets the API enforce. Activating an enrollment
 * requires its registration number.
 */

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import { Switch } from "@/components/shadcn/switch"
import { Badge } from "@/components/shadcn/badge"

type Enrollment = {
  id: string
  isActive: boolean
  registrationDate: string | null
  notes: string | null
  eobiNumber?: string | null
  essiNumber?: string | null
}

type Scheme = "eobi" | "essi"

function EnrollmentEditor({
  guardId,
  scheme,
  title,
  description,
  numberLabel,
}: {
  guardId: string
  scheme: Scheme
  title: string
  description: string
  numberLabel: string
}) {
  const numberKey = scheme === "eobi" ? "eobiNumber" : "essiNumber"
  const apiBase = `/api/deductions/enrollments/${scheme}/${guardId}`

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enrolled, setEnrolled] = useState(false)
  const [number, setNumber] = useState("")
  const [registrationDate, setRegistrationDate] = useState("")
  const [notes, setNotes] = useState("")
  const [serverState, setServerState] = useState<Enrollment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiBase)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? "Failed to load enrollment")
      const row = (data?.data ?? data) as Enrollment | null
      setServerState(row)
      if (row) {
        setEnrolled(row.isActive)
        setNumber((row[numberKey as keyof Enrollment] as string | null) ?? "")
        setRegistrationDate(
          row.registrationDate ? row.registrationDate.slice(0, 10) : ""
        )
        setNotes(row.notes ?? "")
      } else {
        setEnrolled(false)
        setNumber("")
        setRegistrationDate("")
        setNotes("")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [apiBase, numberKey])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (enrolled && !number.trim()) {
      toast.error(`${numberLabel} is required to activate enrollment`)
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        isActive: enrolled,
        [numberKey]: number.trim() || null,
        registrationDate: registrationDate || null,
        notes: notes || null,
      }
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? "Save failed")
      toast.success(`${title} saved`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="mt-1 text-xs">{description}</CardDescription>
          </div>
          {serverState ? (
            serverState.isActive ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-700">
                Enrolled
              </Badge>
            ) : (
              <Badge variant="outline">Not enrolled</Badge>
            )
          ) : (
            <Badge variant="outline">Never enrolled</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={enrolled} onCheckedChange={setEnrolled} />
              <Label className="text-sm">Active enrollment</Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{numberLabel}</Label>
                <Input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder={`Enter ${numberLabel.toLowerCase()}`}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Registration date</Label>
                <Input
                  type="date"
                  value={registrationDate}
                  onChange={(e) => setRegistrationDate(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function StatutoryTab({ guardId }: { guardId: string }) {
  if (!guardId) return null
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <EnrollmentEditor
        guardId={guardId}
        scheme="eobi"
        title="EOBI"
        description="Employees' Old-Age Benefits Institution. When active, EOBI is auto-deducted monthly at the notified rate."
        numberLabel="EOBI number"
      />
      <EnrollmentEditor
        guardId={guardId}
        scheme="essi"
        title="ESSI"
        description="Provincial Social Security. When active, ESSI is auto-deducted monthly at the notified rate."
        numberLabel="ESSI number"
      />
    </div>
  )
}
