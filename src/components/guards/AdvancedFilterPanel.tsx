"use client"

import { ReactNode } from "react"
import { Card, CardContent } from "@/components/shadcn/card"
interface AdvancedFilterPanelProps {
    title?: string
    children: ReactNode
    actions?: ReactNode
}

export default function AdvancedFilterPanel({ title = "Filters", children, actions }: AdvancedFilterPanelProps) {
    return (
        <Card>
            <CardContent className="space-y-4">
                <div className="mb-4 flex items-start justify-between gap-4"><h2 className="text-xl font-bold tracking-tight">{(title)}</h2></div>
                {children}
                {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </CardContent>
        </Card>
    )
}
