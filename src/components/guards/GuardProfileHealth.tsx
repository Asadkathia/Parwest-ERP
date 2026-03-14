"use client"

import { useState, useEffect } from "react"

// ── SVG ring ──────────────────────────────────────────────────────────────────
function Ring({
    pct,
    size = 60,
    stroke = 5,
    color,
}: {
    pct: number
    size?: number
    stroke?: number
    color: string
}) {
    const r = (size - stroke) / 2
    const circumference = 2 * Math.PI * r
    const offset = circumference - (pct / 100) * circumference

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ transform: "rotate(-90deg)" }}
        >
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={stroke}
            />
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
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
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

function pct(filled: number, total: number) {
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

type Section = { label: string; pct: number; color: string }

// ── component ─────────────────────────────────────────────────────────────────
export default function GuardProfileHealth({ guard }: GuardProfileHealthProps) {
    const [show, setShow] = useState(false)
    const [docPct, setDocPct] = useState<number | null>(null)
    const [docLoading, setDocLoading] = useState(false)

    useEffect(() => {
        if (!guard.id) return
        setDocLoading(true)
        fetch(`/api/guards/${guard.id}/prerequisites`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!Array.isArray(data)) return
                const active = data.filter((d: { isActive: boolean }) => d.isActive)
                if (active.length === 0) { setDocPct(0); return }
                const uploaded = active.filter(
                    (d: { attachmentData?: string | null; documentUrl?: string | null }) =>
                        d.attachmentData || d.documentUrl
                ).length
                setDocPct(Math.round((uploaded / active.length) * 100))
            })
            .catch(() => setDocPct(0))
            .finally(() => setDocLoading(false))
    }, [guard.id])

    // ── section calculations ──────────────────────────────────────────────────
    const personalFields = [
        guard.name,
        guard.cnic,
        guard.dateOfBirth,
        guard.fatherName,
        guard.motherName,
        guard.religion,
        guard.maritalStatus,
        guard.education,
        guard.nationality,
    ]
    const contactFields = [
        guard.phone,
        guard.email,
        guard.emergencyContact,
        guard.addressPermanent,
        guard.addressCurrent,
    ]
    const employmentFields = [
        guard.regionalOffice,
        guard.managerName,
        guard.joiningDate,
        guard.enrolledBy,
    ]
    const rels = guard.nearestRelatives ?? []
    const relPct = (() => {
        if (rels.length === 0) return 0
        const complete = rels.filter(
            (r) => has(r.name) && has(r.cnic) && has(r.contact) && has(r.relation)
        ).length
        return pct(complete, rels.length)
    })()

    const sections: Section[] = [
        {
            label: "Personal Info",
            color: "#3b82f6",
            pct: pct(personalFields.filter(has).length, personalFields.length),
        },
        {
            label: "Contact Info",
            color: "#8b5cf6",
            pct: pct(contactFields.filter(has).length, contactFields.length),
        },
        {
            label: "Employment",
            color: "#f59e0b",
            pct: pct(employmentFields.filter(has).length, employmentFields.length),
        },
        {
            label: "Nearest Relatives",
            color: "#10b981",
            pct: relPct,
        },
        {
            label: "Documents",
            color: "#ef4444",
            pct: docLoading ? 0 : (docPct ?? 0),
        },
    ]

    const overall = Math.round(
        sections.reduce((sum, s) => sum + s.pct, 0) / sections.length
    )
    const overallColor =
        overall >= 80 ? "#10b981" : overall >= 50 ? "#f59e0b" : "#ef4444"

    return (
        <div
            className="relative inline-flex items-center gap-3 cursor-default"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {/* Main ring */}
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

            {/* Hover popover */}
            {show && (
                <div
                    className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 z-50
                               bg-white rounded-2xl shadow-2xl border border-gray-100 p-5
                               min-w-[360px] pointer-events-none"
                >
                    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
                        Profile Health
                    </div>

                    {/* Section rings */}
                    <div className="flex items-start justify-between gap-2">
                        {sections.map((s) => (
                            <div key={s.label} className="flex flex-col items-center gap-1.5">
                                <div className="relative">
                                    <Ring pct={s.pct} size={52} stroke={4} color={s.color} />
                                    <span
                                        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                                        style={{ color: s.color }}
                                    >
                                        {s.pct}%
                                    </span>
                                </div>
                                <span className="text-[10px] text-gray-500 text-center leading-tight max-w-[58px]">
                                    {s.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Overall bar */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-gray-500 font-medium">Overall Completeness</span>
                            <span className="font-bold" style={{ color: overallColor }}>
                                {overall}%
                            </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${overall}%`, background: overallColor }}
                            />
                        </div>
                    </div>

                    {/* Arrow tip */}
                    <div
                        className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3.5 h-3.5
                                   bg-white border-r border-b border-gray-100 rotate-45"
                    />
                </div>
            )}
        </div>
    )
}
