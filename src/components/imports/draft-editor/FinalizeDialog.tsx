"use client"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/shadcn/alert-dialog"

export function FinalizeDialog({
  open, onOpenChange, validCount, skippedCount, onConfirm,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  validCount: number
  skippedCount: number
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import {validCount} row{validCount === 1 ? "" : "s"}?</AlertDialogTitle>
          <AlertDialogDescription>
            {skippedCount > 0 ? `${skippedCount} skipped row${skippedCount === 1 ? "" : "s"} will not be imported. ` : ""}
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Import</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
