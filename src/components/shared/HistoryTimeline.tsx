"use client"
import SectionTitle from "@/components/ui/section-title"

interface TimelineEvent {
    id: string
    title: string
    date?: string
    description?: string
    meta?: string
}

interface HistoryTimelineProps {
    title: string
    events: TimelineEvent[]
    emptyText?: string
}

export default function HistoryTimeline({ title, events, emptyText = "No events found" }: HistoryTimelineProps) {
    return (
        <div className="space-y-6">
            <SectionTitle title={title} />

            {events.length === 0 ? (
                <div className="ui-card p-12 text-center text-[var(--text-muted)]">
                    {emptyText}
                </div>
            ) : (
                <div className="ui-card p-6">
                    <ol className="relative border-s border-[var(--border)] ms-3">
                        {events.map((event) => (
                            <li key={event.id} className="mb-8 ms-6">
                                <span className="absolute -start-2.5 mt-1.5 h-4 w-4 rounded-full bg-blue-600" />
                                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                        <h3 className="font-semibold">{event.title}</h3>
                                        <span className="text-sm text-[var(--text-muted)]">
                                            {event.date ? new Date(event.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                                        </span>
                                    </div>
                                    {event.description && <p className="text-sm text-[var(--text)] mt-2">{event.description}</p>}
                                    {event.meta && <p className="text-sm text-[var(--text-muted)] mt-2">{event.meta}</p>}
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    )
}
