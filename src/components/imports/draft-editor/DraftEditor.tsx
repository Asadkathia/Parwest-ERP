"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useDraft } from "@/lib/imports/client/useDraft"
import { DraftHeader } from "./DraftHeader"
import { DraftGrid } from "./DraftGrid"
import { BulkApplyBar } from "./BulkApplyBar"
import { FinalizeDialog } from "./FinalizeDialog"
import { DiscardDialog } from "./DiscardDialog"

export function DraftEditor({ draftId }: { draftId: string }) {
  const router = useRouter()
  const { loading, error, job, columns, totals, rowsByNumber, patchRow, bulkPatch, setSkipped, finalize, discard } = useDraft(draftId)
  const [showFinalize, setShowFinalize] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const sortedRows = useMemo(
    () => [...rowsByNumber.values()].sort((a, b) => a.rowNumber - b.rowNumber),
    [rowsByNumber],
  )

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading draft…</p>
  if (error || !job) return <p className="p-6 text-sm text-destructive">{error ?? "Draft not found"}</p>

  return (
    <div className="p-4">
      <DraftHeader
        fileName={job.fileName}
        status={job.status}
        expiresAt={job.expiresAt}
        totals={totals}
        onDiscard={() => setShowDiscard(true)}
        onFinalize={() => setShowFinalize(true)}
        finalizing={finalizing}
      />
      <BulkApplyBar
        columns={columns}
        rowCount={sortedRows.length}
        onApply={async (header, value) => {
          try {
            await bulkPatch({ [header]: value })
            toast.success("Applied to all rows.")
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Bulk apply failed")
          }
        }}
      />
      <DraftGrid
        rows={sortedRows}
        columns={columns}
        onPatchRow={async (rn, d) => {
          try { await patchRow(rn, d) }
          catch (e) { toast.error(e instanceof Error ? e.message : "Edit failed") }
        }}
        onToggleSkip={async (rn, s) => {
          try { await setSkipped(rn, s) }
          catch (e) { toast.error(e instanceof Error ? e.message : "Skip failed") }
        }}
      />
      <FinalizeDialog
        open={showFinalize}
        onOpenChange={setShowFinalize}
        validCount={totals.valid}
        skippedCount={totals.skipped}
        onConfirm={async () => {
          setShowFinalize(false); setFinalizing(true)
          const { status, payload } = await finalize()
          setFinalizing(false)
          if (status === 200) {
            toast.success(`Imported ${payload.data.successRows} row${payload.data.successRows === 1 ? "" : "s"}.`)
            router.push("/imports")
          } else {
            toast.error(payload?.message || "Finalize failed")
          }
        }}
      />
      <DiscardDialog
        open={showDiscard}
        onOpenChange={setShowDiscard}
        onConfirm={async () => { await discard(); router.push("/imports") }}
      />
    </div>
  )
}
