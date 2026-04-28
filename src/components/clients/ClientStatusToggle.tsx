"use client"

import { useState } from "react"
import { toast } from "sonner"

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
import { Button } from "@/components/shadcn/button"
import { useCanAccess } from "@/components/shadcn/permission-gate"

export default function ClientStatusToggle({
  clientId,
  currentStatus,
}: {
  clientId: string
  currentStatus: string
}) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const canUpdate = useCanAccess("CLIENTS", "UPDATE")

  const next = status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
  const label = loading
    ? "Updating..."
    : status === "ACTIVE"
      ? "Set Inactive"
      : "Set Active"

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // API envelope is `{ success, message, code }` — read `data.message`,
        // not `data.error` (see CLAUDE.md API envelope gotcha).
        const msg =
          (data && typeof data.message === "string" && data.message) ||
          "Failed to update status. Please try again."
        throw new Error(msg)
      }
      setStatus(next)
      setOpen(false)
      toast.success("Client status updated")
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to update status."
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={status === "ACTIVE" ? "destructive" : "secondary"}
          disabled={loading || !canUpdate}
          aria-disabled={!canUpdate}
          title={canUpdate ? undefined : "You don't have access to update clients"}
        >
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change client status?</AlertDialogTitle>
          <AlertDialogDescription>
            Status will change to {next}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Prevent the default close-on-click so we can await the API
              // call and handle errors via toast without flashing closed.
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={loading}
          >
            {loading ? "Updating..." : "Change Status"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
