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
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl border">
                <div className="flex items-center justify-between border-b px-5 py-4">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">Close</button>
                </div>
                <div className="p-5 space-y-4">{children}</div>
                <div className="flex justify-end gap-2 border-t px-5 py-4">
                    <button onClick={onClose} className="border px-4 py-2 rounded-md hover:bg-gray-50">Cancel</button>
                    <button onClick={onConfirm} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">{confirmLabel}</button>
                </div>
            </div>
        </div>
    )
}
