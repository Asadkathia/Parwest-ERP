"use client"

import { useState, useMemo, useEffect } from "react"
import {
  ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, AlertCircle,
  MapPin, Building2, Calendar, Shield, ArrowRight, User, RefreshCw
} from "lucide-react"
import Link from "next/link"
import type { AttendanceRecord, AttendanceSummary, DeploymentAuditRecord } from "@/components/guards/tabs/types"

// ── attendance type config ────────────────────────────────────────────────────
const ATTENDANCE_TYPES: Record<string, { label: string; color: string; dot: string; bg: string; text: string }> = {
  PRESENT:           { label: "Present",            color: "var(--chart-2)", dot: "bg-green-500",   bg: "bg-green-100 dark:bg-green-950/40",   text: "text-green-800 dark:text-green-300" },
  DOUBLE_DUTY_DAY:   { label: "Double Duty (Day)",   color: "var(--chart-1)", dot: "bg-blue-500",    bg: "bg-blue-100 dark:bg-blue-950/40",    text: "text-blue-800 dark:text-blue-300" },
  DOUBLE_DUTY_NIGHT: { label: "Double Duty (Night)", color: "var(--chart-5)", dot: "bg-indigo-500",  bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-800 dark:text-indigo-300" },
  EXTRA_DUTY:        { label: "Extra Duty",          color: "var(--chart-3)", dot: "bg-amber-500",   bg: "bg-amber-100 dark:bg-amber-950/40",  text: "text-amber-800 dark:text-amber-300" },
  ABSENT:            { label: "Absent",              color: "var(--chart-4)", dot: "bg-red-500",     bg: "bg-red-100 dark:bg-red-950/40",    text: "text-red-800 dark:text-red-300" },
  LEAVE:             { label: "Leave",               color: "var(--viz-7)",   dot: "bg-purple-500",  bg: "bg-purple-100 dark:bg-purple-950/40", text: "text-purple-800 dark:text-purple-300" },
}

function getTypeConfig(record: AttendanceRecord) {
  if (record.status === "ABSENT") return ATTENDANCE_TYPES.ABSENT
  if (record.status === "LEAVE")  return ATTENDANCE_TYPES.LEAVE
  const t = record.attendanceType ?? "PRESENT"
  return ATTENDANCE_TYPES[t] ?? ATTENDANCE_TYPES.PRESENT
}

function fmtDate(d: string | Date | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function daysBetween(from: string | Date, to: string | Date) {
  const a = new Date(from); a.setHours(0, 0, 0, 0)
  const b = new Date(to);   b.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

// ── mini calendar ─────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

function AttendanceCalendar({ attendance }: { attendance: AttendanceRecord[] }) {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [hovered, setHovered] = useState<AttendanceRecord | null>(null)

  const lookup = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {}
    for (const rec of attendance) {
      const d = new Date(rec.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
      map[key] = rec
    }
    return map
  }, [attendance])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)]

  return (
    <div className="ui-card p-5 select-none">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] transition-colors">
          <ChevronLeft className="h-4 w-4 text-[var(--text-muted)] rtl:rotate-180" />
        </button>
        <h3 className="text-sm font-semibold text-[var(--text)]">{MONTHS[month]} {year}</h3>
        <button onClick={next} className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] transition-colors">
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)] rtl:rotate-180" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-[var(--text-muted)] py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const key = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
          const rec = lookup[key]
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          const cfg = rec ? getTypeConfig(rec) : null
          return (
            <div key={key}
              className="relative flex flex-col items-center py-1.5 rounded-lg cursor-default"
              onMouseEnter={() => setHovered(rec ?? null)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className={`text-[11px] font-medium leading-none mb-1 ${
                isToday ? "text-[var(--brand)] font-bold" : rec ? "text-[var(--text)]" : "text-[var(--text-muted)]"
              }`}>{day}</span>
              {cfg
                ? <span className={`w-2 h-2 rounded-full ${cfg.dot}`} title={cfg.label} />
                : <span className="w-2 h-2 rounded-full bg-transparent" />}
              {isToday && (
                <span className="absolute bottom-0.5 start-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--brand)]" />
              )}
            </div>
          )
        })}
      </div>

      {hovered && (() => {
        const cfg = getTypeConfig(hovered)
        return (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${cfg.bg} ${cfg.text} border border-current/10`}>
            <span className="font-semibold">{new Date(hovered.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            {" · "}<span>{cfg.label}</span>
            {hovered.clientName && <span className="ms-1 opacity-70">@ {hovered.clientName}</span>}
            {hovered.shift && <span className="ms-1 opacity-70">({hovered.shift})</span>}
            {hovered.hours && <span className="ms-1 opacity-70">· {hovered.hours}h</span>}
          </div>
        )
      })()}

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

// ── status badge ──────────────────────────────────────────────────────────────
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

// ── active deployment info banner ─────────────────────────────────────────────
function ActiveDeploymentBanner({ dep }: { dep: DeploymentAuditRecord }) {
  const today = new Date()
  const duration = daysBetween(dep.deploymentDate, today)
  return (
    <div className="rounded-[var(--radius-md)] border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
            <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Currently Deployed</p>
            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{dep.client.name}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
          dep.shiftType === "DAY"
            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
            : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50"
        }`}>
          <Clock className="h-3 w-3" />
          {dep.shiftType}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {dep.branch && (
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Branch</p>
              <p className="font-medium text-emerald-900 dark:text-emerald-100 text-xs">
                {dep.branch.name}{dep.branch.city ? `, ${dep.branch.city}` : ""}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-start gap-1.5">
          <User className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Designation</p>
            <p className="font-medium text-emerald-900 dark:text-emerald-100 text-xs">{dep.designation}</p>
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Since</p>
            <p className="font-medium text-emerald-900 dark:text-emerald-100 text-xs">{fmtDate(dep.deploymentDate)}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Duration</p>
          <p className="font-medium text-emerald-900 dark:text-emerald-100 text-xs">{duration} day{duration !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {dep.deployedByName && (
        <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">
          Deployed by <strong>{dep.deployedByName}</strong> · {fmtDate(dep.deploymentDate)}
        </p>
      )}
    </div>
  )
}

// ── deployment audit log ──────────────────────────────────────────────────────
function DeploymentAuditLog({ deployments }: { deployments: DeploymentAuditRecord[]; guardId?: string }) {
  const sorted = [...deployments].sort(
    (a, b) => new Date(b.deploymentDate).getTime() - new Date(a.deploymentDate).getTime()
  )

  if (sorted.length === 0) return (
    <div className="text-center py-8 text-[var(--text-muted)] text-sm">No deployment history found.</div>
  )

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute start-4 top-0 bottom-0 w-px bg-[var(--border)]" />

      <div className="space-y-0">
        {sorted.map((dep, idx) => {
          const isActive = dep.status === "ACTIVE"
          const duration = dep.endDate
            ? daysBetween(dep.deploymentDate, dep.endDate)
            : daysBetween(dep.deploymentDate, new Date())

          // Detect if this was a change (endReason starts with [CHANGE])
          const wasChanged = dep.endReason?.startsWith("[CHANGE]")
          const endReasonDisplay = dep.endReason
            ? dep.endReason.replace(/^\[CHANGE\]\s*/, "").replace(/^\[[A-Z_]+\]\s*/, "")
            : null

          return (
            <div key={dep.id} className="relative ps-10 pb-6">
              {/* Timeline dot */}
              <div className={`absolute start-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-card ${
                isActive ? "bg-emerald-500" : wasChanged ? "bg-blue-400" : "bg-muted-foreground"
              }`} />

              <div className={`rounded-[var(--radius-md)] border p-4 ${
                isActive
                  ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20"
                  : "border-[var(--border)] bg-[var(--surface-muted)]/50"
              }`}>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {isActive ? "● ACTIVE" : wasChanged ? "↔ CHANGED" : "◉ ENDED"}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      dep.shiftType === "DAY"
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
                        : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50"
                    }`}>
                      <Clock className="h-3 w-3" />
                      {dep.shiftType}
                    </span>
                    {dep.deploymentNature && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-muted)] border border-[var(--border)]">
                        {dep.deploymentNature === "TEMPORARY" ? "Temporary" : "Permanent"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                    {fmtDate(dep.deploymentDate)}
                    {dep.endDate ? ` → ${fmtDate(dep.endDate)}` : " → Present"}
                    {" "}({duration} day{duration !== 1 ? "s" : ""})
                  </span>
                </div>

                {/* Location */}
                <div className="flex items-start gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-[var(--text)]">{dep.client.name}</p>
                    {dep.branch && (
                      <p className="text-xs text-[var(--text-muted)]">
                        <MapPin className="h-3 w-3 inline me-0.5" />
                        {dep.branch.name}{dep.branch.city ? `, ${dep.branch.city}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Details row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-[var(--text-muted)]">
                  <div>
                    <span className="font-medium text-[var(--text)]">Role: </span>
                    {dep.designation}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text)]">Office: </span>
                    {dep.regionalOffice.name}
                  </div>
                  {dep.deploymentType && (
                    <div>
                      <span className="font-medium text-[var(--text)]">Type: </span>
                      {dep.deploymentType}
                    </div>
                  )}
                </div>

                {/* Audit trail */}
                <div className="mt-3 pt-3 border-t border-[var(--border)]/60 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                  {dep.deployedByName && (
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3 text-emerald-500" />
                      Deployed by <strong className="text-[var(--text)] ms-0.5">{dep.deployedByName}</strong>
                    </span>
                  )}
                  {!isActive && dep.revokedByName && (
                    <span className="flex items-center gap-1">
                      {wasChanged
                        ? <RefreshCw className="h-3 w-3 text-blue-400" />
                        : <ArrowRight className="h-3 w-3 text-red-400" />}
                      {wasChanged ? "Changed" : "Revoked"} by <strong className="text-[var(--text)] ms-0.5">{dep.revokedByName}</strong>
                    </span>
                  )}
                  {!isActive && endReasonDisplay && (
                    <span className="italic text-[var(--text-muted)]">&quot;{endReasonDisplay}&quot;</span>
                  )}
                </div>

                {/* Link to deployment */}
                {idx === 0 || isActive ? (
                  <div className="mt-2">
                    <Link href={`/deployments/${dep.id}`}
                      className="text-xs text-[var(--brand)] hover:underline font-medium">
                      View deployment →
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
interface AttendanceTabProps {
  attendance: AttendanceRecord[]
  attendanceSummary: AttendanceSummary
  deployments?: DeploymentAuditRecord[]
  guardId?: string
}

export default function AttendanceTab({ attendance, attendanceSummary, deployments = [], guardId }: AttendanceTabProps) {
  const [view, setView] = useState<"calendar" | "table">("calendar")
  const [section, setSection] = useState<"attendance" | "audit">("attendance")
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [generated, setGenerated] = useState<number | null>(null)

  const sorted = useMemo(() => [...attendance].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ), [attendance])

  const activeDeployments = deployments.filter((d) => d.status === "ACTIVE")

  // Auto-generate attendance on mount if guard has active deployments
  useEffect(() => {
    if (!guardId || activeDeployments.length === 0) return
    setAutoGenerating(true)
    fetch(`/api/guards/${guardId}/attendance/auto-generate`, { method: "POST" })
      .then((r) => r.json())
      .then((data: { generated: number }) => {
        if (data.generated > 0) setGenerated(data.generated)
      })
      .catch(() => null)
      .finally(() => setAutoGenerating(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardId])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-[var(--text)]">Attendance & Deployment</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden text-sm">
            <button onClick={() => setSection("attendance")}
              className={`px-3 py-1.5 font-medium transition-colors ${section === "attendance" ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"}`}>
              Attendance
            </button>
            <button onClick={() => setSection("audit")}
              className={`px-3 py-1.5 font-medium border-s border-[var(--border)] transition-colors ${section === "audit" ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"}`}>
              Deployment Log
            </button>
          </div>
          {section === "attendance" && (
            <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden text-sm">
              <button onClick={() => setView("calendar")}
                className={`px-3 py-1.5 font-medium transition-colors ${view === "calendar" ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"}`}>
                Calendar
              </button>
              <button onClick={() => setView("table")}
                className={`px-3 py-1.5 font-medium border-s border-[var(--border)] transition-colors ${view === "table" ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"}`}>
                Table
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Auto-generate notice */}
      {autoGenerating && (
        <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand)] animate-pulse" />
          Syncing attendance records...
        </div>
      )}
      {generated !== null && generated > 0 && (
        <div className="rounded-[var(--radius-md)] border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5" />
          {generated} attendance record{generated !== 1 ? "s" : ""} auto-generated from active deployment.
          Refresh to see updated records.
        </div>
      )}

      {/* Active deployment banner — always visible */}
      {activeDeployments.length > 0 && section === "attendance" && (
        <div className="space-y-2">
          {activeDeployments.map((dep) => (
            <ActiveDeploymentBanner key={dep.id} dep={dep} />
          ))}
        </div>
      )}

      {section === "attendance" ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Days",     value: attendanceSummary.totalDays ?? 0, color: "text-[var(--text)]" },
              { label: "Present",        value: attendanceSummary.present   ?? 0, color: "text-green-600" },
              { label: "Absent",         value: attendanceSummary.absent    ?? 0, color: "text-red-600" },
              { label: "Overtime Hours", value: attendanceSummary.overtime  ?? 0, color: "text-blue-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="ui-card p-4">
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Calendar / Table */}
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
                          <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{h}</th>
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
        </>
      ) : (
        /* Deployment Audit Log section */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text)]">Deployment History</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                All deployments, transfers, and revocations — full audit trail
              </p>
            </div>
            <span className="text-sm text-[var(--text-muted)]">{deployments.length} record{deployments.length !== 1 ? "s" : ""}</span>
          </div>
          <DeploymentAuditLog deployments={deployments} guardId={guardId} />
        </div>
      )}
    </div>
  )
}