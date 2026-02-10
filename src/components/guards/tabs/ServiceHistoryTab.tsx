"use client"

import HistoryTimeline from "@/components/shared/HistoryTimeline"

interface ServiceHistoryTabProps {
    serviceHistory: any[]
}

export default function ServiceHistoryTab({ serviceHistory }: ServiceHistoryTabProps) {
    const events = (serviceHistory || []).map((event) => ({
        id: event.id,
        title: event.event,
        date: event.date,
        description: event.description || "No description provided.",
        meta: event.changedBy ? `Updated by: ${event.changedBy}` : undefined,
    }))

    return <HistoryTimeline title="Service History" events={events} emptyText="No service events found" />
}
