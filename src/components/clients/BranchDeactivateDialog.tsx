"use client"

/**
 * Parwest ERP — Branch Deactivate Dialog
 * ─────────────────────────────────────────────────────────────────────────
 * Destructive shadcn AlertDialog that drives the branch deactivation cascade
 * (POST /api/branches/[id]/deactivate). Captures a MANDATORY reason + an
 * effective date, then ends active deployments and flags affected guards'
 * assigned inventory for return server-side. Browser confirm() is banned;
 * this uses AlertDialog with a destructive confirm button.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PowerOff } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import { Textarea } from "@/components/shadcn/textarea"
import { PermissionGate } from "@/components/shadcn/permission-gate"
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

interface Props {
  branchId: string
  branchName: string
}

function todayISODate(): string {
  // YYYY-MM-DD for a native date input, in the local timezone.
  const now = new Date()
  const tzOffset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10)
}

export default function BranchDeactivateDialog({ branchId, branchName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [effectiveDate, setEffectiveDate] = useState(todayISODate())
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  const reasonEmpty = reason.trim().length === 0

  const handleConfirm = async (event: React.MouseEvent) => {
    // Keep the dialog open so we can show validation/errors; close on success.
    event.preventDefault()
    if (reasonEmpty || submitting) return
    setSubmitting(true)
    try {
      const response = await fetch(`/api/branches/${branchId}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), effectiveDate }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const msg =
          (data && typeof data === "object" && "message" in data && typeof data.message === "string"
            ? data.message
            : null) || "Failed to deactivate branch"
        toast.error(msg)
        return
      }

      const successMsg =
        (data && typeof data === "object" && "message" in data && typeof data.message === "string"
          ? data.message
          : null) || "Branch deactivated."
      toast.success(successMsg)
      setOpen(false)
      setReason("")
      startTransition(() => {
        router.refresh()
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PermissionGate module="CLIENTS" action="UPDATE" mode="disable">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <PowerOff className="mr-2 h-4 w-4" />
            Deactivate Branch
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate branch?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                You are about to deactivate{" "}
                <span className="font-medium text-foreground">{branchName}</span>. Active
                deployments at this branch will be ended, and (if enabled) the affected
                guards&apos; assigned inventory will be flagged for return.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="branch-deactivate-effective-date">Effective date</Label>
              <Input
                id="branch-deactivate-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-deactivate-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="branch-deactivate-reason"
                placeholder="Why is this branch being deactivated?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
                rows={3}
                aria-required
              />
              {reasonEmpty ? (
                <p className="text-xs text-muted-foreground">A reason is required.</p>
              ) : null}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Keep branch active</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={reasonEmpty || submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "Deactivating…" : "Deactivate Branch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGate>
  )
}
