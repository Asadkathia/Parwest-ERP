"use client"

import { ReactNode } from "react"

interface AdvancedFilterPanelProps {
    title?: string
    children: ReactNode
    actions?: ReactNode
}

export default function AdvancedFilterPanel({ title = "Filters", children, actions }: AdvancedFilterPanelProps) {
    return (
        <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="font-semibold">{title}</h2>
            {children}
            {actions && <div className="flex gap-3">{actions}</div>}
        </div>
    )
}
