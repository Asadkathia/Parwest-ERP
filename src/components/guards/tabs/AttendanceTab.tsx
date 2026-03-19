"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"
import type { AttendanceRecord, AttendanceSummary } from "@/components/guards/tabs/types"

// ── attendance type config ────────────────────────────────────────────────────
const ATTENDANCE_TYPES: Record<string, { label: string; color: string; dot: string; bg: string; text: string }> = {
    PRESENT:          { label: "Present",          color: "#10b981", dot: "bg-green-500",   bg: "bg-green-100",  text: "text-green-800" },
    DOUBLE_DUTY_DAY:  { label: "Double Duty (Day)",  color: "#3b82f6", dot: "bg-blue-500",    bg: "bg-blue-100",   text: "text-blue-800" },
    DOUBLE_DUTY_NIGHT:{ label: "Double Duty (Night)",color: "#6366f1", dot: "bg-indigo-500",  bg: "bg-indigo-100", text: "text-indigo-800" },
    EXTRA_DUTY:       { label: "Extra Duty",        color: "#f59e0b", dot: "bg-amber-500",   bg: "bg-amber-100",  text: "text-amber-800" },
    ABSENT:           { label: "Absent",            color: "#ef4444", dot: "bg-red-500",     bg: "bg-red-100",    text: "text-red-800" },
    LEAVE:            { label: "Leave",             color: "#8b5cf6", dot: "bg-purple-500",  bg: "bg-purple-100", text: "text-purple-800" },
}

function getTypeConfig(record: AttendanceRecord) {
    if (record.status === "ABSENT") return ATTENDANCE_TYPES.ABSENT
    if (record.status === "LEAVE")  return ATTENDANCE_TYPES.LEAVE
    const t = record.attendanceType ?? "PRESENT"
    return ATTENDANCE_TYPES[t] ?? ATTENDANCE_TYPES.PRESENT
}

// ── mini calendar ─────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

function AttendanceCalendar({ attendance }: { attendance: AttendanceRecord[] }) {
    const today = new Date()
    const [year,  setYear]  = useState(today.getFullYear())
    const [month, setMonth] = useState(today.getMonth())
    const [hovered, setHovered] = useState<AttendanceRecord | null>(null)

    // Build a lookup: "YYYY-MM-DD" → record
    const lookup = useMemo(() => {
        const map: Record<string, AttendanceRecord> = {}
        for (const rec of attendance) {
            const d = new Date(rec.date)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
            map[key] = rec
        }
        return map
    }, [attendance])

    const firstDay = new Date(year, month, 1).getDay()   // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
    const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

    const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)]

    return (
        <div className="ui-card p-5 select-none">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={prev} className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] transition-colors">
                    <ChevronLeft className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
                <h3 className="text-sm font-semibold text-[var(--text)]">{MONTHS[month]} {year}</h3>
                <button onClick={next} className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] transition-colors">
                    <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-[var(--text-muted)] py-1">{d}</div>
                ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-y-1">
                {cells.map((day, i) => {
                    if (!day) return <div key={i} />
                    const key = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
                    const rec = lookup[key]
                    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                    const cfg = rec ? getTypeConfig(rec) : null

                    return (
                        <div
                            key={key}
                            className="relative flex flex-col items-center py-1.5 rounded-lg cursor-default group"
                            onMouseEnter={() => setHovered(rec ?? null)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            <span className={`text-[11px] font-medium leading-none mb-1 ${
                                isToday ? "text-[var(--brand)] font-bold" : rec ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                            }`}>
                                {day}
                            </span>
                            {cfg ? (
                                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} title={cfg.label} />
                            ) : (
                                <span className="w-2 h-2 rounded-full bg-transparent" />
                            )}
                            {isToday && (
                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--brand)]" />
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Hovered record tooltip */}
            {hovered && (() => {
                const cfg = getTypeConfig(hovered)
                return (
                    <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${cfg.bg} ${cfg.text} border border-current/10`}>
                        <span className="font-semibold">{new Date(hovered.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {" · "}<span>{cfg.label}</span>
                        {hovered.clientName && <span className="ml-1 opacity-70">@ {hovered.clientName}</span>}
                        {hovered.shift && <span className="ml-1 opacity-70">({hovered.shift})</span>}
                        {hovered.hours && <span className="ml-1 opacity-70">· {hovered.hours}h</span>}
                    </div>
                )
            })()}

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap gap-x-4 gap-y-1.5">
                {Object.entries(ATTENDANCE_TYPES).map(([, cfg]) => (
                    <div key={cfg.label} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span className="text-[10px] text-[var(--text-muted)]">{cfg.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── status icon / badge ───────────────────────────────────────────────────────
function StatusBadge({ record }: { record: AttendanceRecord }) {
    const cfg = getTypeConfig(record)
    const Icon = record.status === "PRESENT" ? CheckCircle
        : record.status === "ABSENT" ? XCircle
        : record.status === "LEAVE" ? Clock
        : AlertCircle
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
            <Icon className="h-3 w-3" />
            {cfg.label}
        </span>
    )
}

// ── main component ────────────────────────────────────────────────────────────
interface AttendanceTabProps {
    attendance: AttendanceRecord[]
    attendanceSummary: AttendanceSummary
}

export default function AttendanceTab({ attendance, attendanceSummary }: AttendanceTabProps) {
    const [view, setView] = useState<"calendar" | "table">("calendar")

    const sorted = useMemo(() => [...attendance].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    ), [attendance])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[var(--text)]">Attendance</h2>
                <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden text-sm">
                        <button
                            onClick={() => setView("calendar")}
                            className={`px-3 py-1.5 font-medium transition-colors ${view === "calendar" ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"}`}
                        >
                            Calendar
                        </button>
                        <button
                            onClick={() => setView("table")}
                            className={`px-3 py-1.5 font-medium border-l border-[var(--border)] transition-colors ${view === "table" ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"}`}
                        >
                            Table
                        </button>
                    </div>
                    <button className="ui-btn ui-btn-primary text-sm px-3 py-1.5">Export Report</button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Total Days",     value: attendanceSummary.totalDays ?? 0,  color: "text-[var(--text)]" },
                    { label: "Present",        value: attendanceSummary.present   ?? 0,  color: "text-green-600" },
                    { label: "Absent",         value: attendanceSummary.absent    ?? 0,  color: "text-red-600" },
                    { label: "Overtime Hours", value: attendanceSummary.overtime  ?? 0,  color: "text-blue-600" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="ui-card p-4">
                        <p className="text-xs text-[var(--text-muted)]">{label}</p>
                        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* Calendar or Table */}
            {view === "calendar" ? (
                <AttendanceCalendar attendance={attendance} />
            ) : (
                <div className="ui-card overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--border)]">
                        <h3 className="text-sm font-semibold text-[var(--text)]">Attendance Records</h3>
                    </div>
                    {sorted.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">No attendance records found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[var(--surface-muted)]">
                                    <tr>
                                        {["Date","Status","Client","Shift","Hours","Overtime","Remarks"].map(h => (
                                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {sorted.map((record, i) => (
                                        <tr key={i} className="hover:bg-[var(--surface-muted)] transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap font-medium">
                                                {new Date(record.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                            </td>
                                            <td className="px-4 py-3"><StatusBadge record={record} /></td>
                                            <td className="px-4 py-3 text-[var(--text-muted)]">{record.clientName ?? "—"}</td>
                                            <td className="px-4 py-3 text-[var(--text-muted)]">{record.shift ?? "—"}</td>
                                            <td className="px-4 py-3 text-[var(--text-muted)]">{record.hours ?? "—"}</td>
                                            <td className="px-4 py-3 text-[var(--text-muted)]">{record.overtime ? `+${record.overtime}h` : "—"}</td>
                                            <td className="px-4 py-3 text-[var(--text-muted)]">{record.reason ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
