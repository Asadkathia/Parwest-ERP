"use client"

import HistoryTimeline from "@/components/shared/HistoryTimeline"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type ServiceHistoryEvent = {
    id: string
    event?: string
    date?: string
    description?: string
    changedBy?: string
}

interface ServiceHistoryTabProps {
    serviceHistory: GuardLooseRow[]
}

export default function ServiceHistoryTab({ serviceHistory }: ServiceHistoryTabProps) {
    const events = ((serviceHistory || []) as ServiceHistoryEvent[]).map((event) => ({
        id: event.id,
        title: event.event || "Service update",
        date: event.date || new Date().toISOString(),
        description: event.description || "No description provided.",
        meta: event.changedBy ? `Updated by: ${event.changedBy}` : undefined,
    }))

    return <HistoryTimeline title="Service History" events={events} emptyText="No service events found" />
}
