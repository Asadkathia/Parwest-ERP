"use client"

import { ReactNode } from "react"

interface ExportDialogProps {
    open: boolean
    title?: string
    onClose: () => void
    onConfirm: () => void
    confirmLabel?: string
    children: ReactNode
}

export default function ExportDialog({
    open,
    title = "Export",
    onClose,
    onConfirm,
    confirmLabel = "Generate Export",
    children,
}: ExportDialogProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-2xl rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-md)] border border-[var(--border)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button onClick={onClose} className="ui-btn ui-btn-secondary">Close</button>
                </div>
                <div className="p-5 space-y-4">{children}</div>
                <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4 bg-[var(--surface-muted)]">
                    <button onClick={onClose} className="ui-btn ui-btn-secondary">Cancel</button>
                    <button onClick={onConfirm} className="ui-btn ui-btn-primary">{confirmLabel}</button>
                </div>
            </div>
        </div>
    )
}
