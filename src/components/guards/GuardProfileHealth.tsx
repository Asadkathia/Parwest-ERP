"use client"

import { useState, useEffect } from "react"

// ── SVG ring ──────────────────────────────────────────────────────────────────
function Ring({
    pct,
    size = 60,
    stroke = 5,
    color,
    animate = false,
    delay = 0,
}: {
    pct: number
    size?: number
    stroke?: number
    color: string
    animate?: boolean
    delay?: number
}) {
    const [displayed, setDisplayed] = useState(animate ? 0 : pct)

    useEffect(() => {
        if (!animate) {
            const rafId = requestAnimationFrame(() => setDisplayed(pct))
            return () => cancelAnimationFrame(rafId)
        }
        const resetRafId = requestAnimationFrame(() => setDisplayed(0))
        const t = setTimeout(() => setDisplayed(pct), delay)
        return () => {
            cancelAnimationFrame(resetRafId)
            clearTimeout(t)
        }
    }, [pct, animate, delay])

    const r = (size - stroke) / 2
    const circumference = 2 * Math.PI * r
    const offset = circumference - (displayed / 100) * circumference

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ transform: "rotate(-90deg)" }}
        >
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeDasharray={`${circumference}`}
                strokeDashoffset={`${offset}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)" }}
            />
        </svg>
    )
}

// ── helpers ───────────────────────────────────────────────────────────────────
function has(v: unknown): boolean {
    if (v === null || v === undefined || v === "" || v === "—") return false
    if (typeof v === "object" && !Array.isArray(v)) {
        const name = (v as { name?: string | null }).name
        return name !== null && name !== undefined && name !== "" && name !== "—"
    }
    return true
}

function calcPct(filled: number, total: number) {
    return total === 0 ? 0 : Math.round((filled / total) * 100)
}

// ── props ─────────────────────────────────────────────────────────────────────
interface GuardProfileHealthProps {
    guard: {
        id?: string
        name?: string | null
        cnic?: string | null
        dateOfBirth?: string | Date | null
        fatherName?: string | null
        motherName?: string | null
        religion?: string | null
        maritalStatus?: string | null
        education?: string | null
        nationality?: string | null
        phone?: string | null
        email?: string | null
        emergencyContact?: string | null
        addressPermanent?: string | null
        addressCurrent?: string | null
        regionalOffice?: string | { name?: string | null } | null
        managerName?: string | null
        joiningDate?: string | Date | null
        enrolledBy?: string | null
        nearestRelatives?: Array<{
            name?: string
            cnic?: string
            contact?: string
            relation?: string
        }>
    }
}

type Section = { label: string; value: number; color: string }

// ── component ─────────────────────────────────────────────────────────────────
export default function GuardProfileHealth({ guard }: GuardProfileHealthProps) {
    const [show, setShow] = useState(false)
    const [visible, setVisible] = useState(false)
    const [docPct, setDocPct] = useState<number | null>(null)
    const [docLoading, setDocLoading] = useState(false)

    // animate in/out
    useEffect(() => {
        let rafId: number | null = null
        if (show) {
            rafId = requestAnimationFrame(() => setVisible(true))
        } else {
            rafId = requestAnimationFrame(() => setVisible(false))
        }
        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId)
        }
    }, [show])

    useEffect(() => {
        if (!guard.id) return
        let cancelled = false
        const markLoading = Promise.resolve().then(() => {
            if (!cancelled) setDocLoading(true)
        })
        fetch(`/api/guards/${guard.id}/prerequisites`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (cancelled) return
                if (!Array.isArray(data)) return
                const active = data.filter((d: { isActive: boolean }) => d.isActive)
                if (active.length === 0) { setDocPct(0); return }
                const uploaded = active.filter(
                    (d: { attachmentData?: string | null; documentUrl?: string | null }) =>
                        d.attachmentData || d.documentUrl
                ).length
                setDocPct(Math.round((uploaded / active.length) * 100))
            })
            .catch(() => {
                if (!cancelled) setDocPct(0)
            })
            .finally(() => {
                if (!cancelled) setDocLoading(false)
            })
        return () => {
            cancelled = true
            void markLoading
        }
    }, [guard.id])

    // ── section calculations ──────────────────────────────────────────────────
    const personalFields = [
        guard.name, guard.cnic, guard.dateOfBirth,
        guard.fatherName, guard.motherName, guard.religion,
        guard.maritalStatus, guard.education, guard.nationality,
    ]
    const contactFields = [
        guard.phone, guard.email, guard.emergencyContact,
        guard.addressPermanent, guard.addressCurrent,
    ]
    const employmentFields = [
        guard.regionalOffice, guard.managerName,
        guard.joiningDate, guard.enrolledBy,
    ]
    const rels = guard.nearestRelatives ?? []
    const relPct = rels.length === 0 ? 0 : calcPct(
        rels.filter((r) => has(r.name) && has(r.cnic) && has(r.contact) && has(r.relation)).length,
        rels.length
    )

    const sections: Section[] = [
        { label: "Personal Info",      color: "#3b82f6", value: calcPct(personalFields.filter(has).length, personalFields.length) },
        { label: "Contact Info",       color: "#8b5cf6", value: calcPct(contactFields.filter(has).length, contactFields.length) },
        { label: "Employment",         color: "#f59e0b", value: calcPct(employmentFields.filter(has).length, employmentFields.length) },
        { label: "Nearest Relatives",  color: "#10b981", value: relPct },
        { label: "Documents",          color: "#ef4444", value: docLoading ? 0 : (docPct ?? 0) },
    ]

    const overall = Math.round(sections.reduce((s, x) => s + x.value, 0) / sections.length)
    const overallColor = overall >= 80 ? "#10b981" : overall >= 50 ? "#f59e0b" : "#ef4444"

    return (
        <div
            className="relative inline-flex items-center gap-3 cursor-default"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {/* ── Trigger: main ring ── */}
            <div className="relative shrink-0">
                <Ring pct={overall} size={52} stroke={5} color={overallColor} />
                <span
                    className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
                    style={{ color: overallColor }}
                >
                    {overall}%
                </span>
            </div>
            <div className="leading-tight">
                <div className="text-xs font-semibold text-gray-700">Profile</div>
                <div className="text-[11px] text-gray-400">Completeness</div>
            </div>

            {/* ── Popover: expands to the right ── */}
            <div
                className="absolute left-full top-1/2 ml-3 z-50 pointer-events-none"
                style={{
                    transform: `translateY(-50%) translateX(${visible ? "0px" : "-10px"})`,
                    opacity: visible ? 1 : 0,
                    transition: "opacity 0.25s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1)",
                }}
            >
                {/* Left arrow tip */}
                <div
                    className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-l border-b border-gray-100 rotate-45"
                />

                <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 min-w-[380px]">
                    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
                        Profile Health
                    </div>

                    {/* Section rings */}
                    <div className="flex items-start justify-between gap-1">
                        {sections.map((s, i) => (
                            <div
                                key={s.label}
                                className="flex flex-col items-center gap-1.5"
                                style={{
                                    opacity: visible ? 1 : 0,
                                    transform: `translateX(${visible ? "0px" : "-6px"})`,
                                    transition: `opacity 0.3s ease ${0.08 + i * 0.06}s, transform 0.35s cubic-bezier(0.34,1.3,0.64,1) ${0.08 + i * 0.06}s`,
                                }}
                            >
                                <div className="relative">
                                    <Ring
                                        pct={s.value}
                                        size={54}
                                        stroke={4}
                                        color={s.color}
                                        animate={show}
                                        delay={100 + i * 70}
                                    />
                                    <span
                                        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                                        style={{ color: s.color }}
                                    >
                                        {s.value}%
                                    </span>
                                </div>
                                <span className="text-[10px] text-gray-500 text-center leading-tight max-w-[60px]">
                                    {s.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Overall progress bar */}
                    <div
                        className="mt-4 pt-3 border-t border-gray-100"
                        style={{
                            opacity: visible ? 1 : 0,
                            transition: "opacity 0.3s ease 0.45s",
                        }}
                    >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-gray-500 font-medium">Overall Completeness</span>
                            <span className="font-bold" style={{ color: overallColor }}>{overall}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: visible ? `${overall}%` : "0%",
                                    background: overallColor,
                                    transition: "width 0.7s cubic-bezier(0.4,0,0.2,1) 0.4s",
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
