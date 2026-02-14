"use client"

import { ReactNode } from "react"
import { Card, CardBody } from "@/components/ui/card"
import SectionTitle from "@/components/ui/section-title"

interface AdvancedFilterPanelProps {
    title?: string
    children: ReactNode
    actions?: ReactNode
}

export default function AdvancedFilterPanel({ title = "Filters", children, actions }: AdvancedFilterPanelProps) {
    return (
        <Card>
            <CardBody className="space-y-4">
                <SectionTitle title={title} />
                {children}
                {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </CardBody>
        </Card>
    )
}
