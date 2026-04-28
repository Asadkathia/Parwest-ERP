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
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-default)" strokeWidth={stroke} />
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
    // Phase controls the animation sequence
    // 0 = hidden, 1 = panel expanding (max-width), 2 = items appearing, 3 = bar filling
    const [phase, setPhase] = useState(0)
    const [docPct, setDocPct] = useState<number | null>(null)
    const [docLoading, setDocLoading] = useState(false)

    useEffect(() => {
        let t1: ReturnType<typeof setTimeout>
        let t2: ReturnType<typeof setTimeout>
        if (show) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- animation phase orchestration driven by `show` prop
            setPhase(1)                           // panel expands right
            t1 = setTimeout(() => setPhase(2), 200) // items slide in
            t2 = setTimeout(() => setPhase(3), 640) // bar fills
        } else {
            setPhase(0)
        }
        return () => { clearTimeout(t1); clearTimeout(t2) }
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
                    (d: { hasAttachment?: boolean; documentUrl?: string | null }) =>
                        d.hasAttachment || d.documentUrl
                ).length
                setDocPct(Math.round((uploaded / active.length) * 100))
            })
            .catch(() => { if (!cancelled) setDocPct(0) })
            .finally(() => { if (!cancelled) setDocLoading(false) })
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
        { label: "Personal Info",     color: "var(--chart-1)", value: calcPct(personalFields.filter(has).length, personalFields.length) },
        { label: "Contact Info",      color: "var(--viz-7)",   value: calcPct(contactFields.filter(has).length, contactFields.length) },
        { label: "Employment",        color: "var(--chart-3)", value: calcPct(employmentFields.filter(has).length, employmentFields.length) },
        { label: "Nearest Relatives", color: "var(--chart-2)", value: relPct },
        { label: "Documents",         color: "var(--chart-4)", value: docLoading ? 0 : (docPct ?? 0) },
    ]

    const overall = Math.round(sections.reduce((s, x) => s + x.value, 0) / sections.length)
    const overallColor = overall >= 80 ? "var(--success-500)" : overall >= 50 ? "var(--warning-500)" : "var(--danger-500)"

    return (
        <div
            className="flex items-center gap-0 cursor-default"
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
            <div className="leading-tight ms-3 shrink-0">
                <div className="text-xs font-semibold text-foreground">Profile</div>
                <div className="text-[11px] text-muted-foreground">Completeness</div>
            </div>

            {/* ── Inline expandable panel ── */}
            <div
                style={{
                    maxWidth: phase >= 1 ? "520px" : "0px",
                    opacity: phase >= 1 ? 1 : 0,
                    overflow: "hidden",
                    transition: phase >= 1
                        ? "max-width 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease"
                        : "max-width 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease",
                    display: "flex",
                    alignItems: "stretch",
                    flexShrink: 0,
                }}
            >
                {/* Vertical divider */}
                <div
                    className="mx-4 w-px bg-muted-foreground/20 self-stretch shrink-0"
                    style={{
                        opacity: phase >= 1 ? 1 : 0,
                        transition: "opacity 0.2s ease 0.15s",
                    }}
                />

                {/* Content */}
                <div className="flex flex-col justify-center gap-2 py-0.5" style={{ minWidth: "460px" }}>
                    {/* Label */}
                    <div
                        className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
                        style={{
                            opacity: phase >= 2 ? 1 : 0,
                            transform: phase >= 2 ? "translateX(0)" : "translateX(-6px)",
                            transition: "opacity 0.22s ease 0.05s, transform 0.28s cubic-bezier(0.34,1.2,0.64,1) 0.05s",
                        }}
                    >
                        Profile Health
                    </div>

                    {/* Section rings row */}
                    <div className="flex items-center gap-4">
                        {sections.map((s, i) => (
                            <div
                                key={s.label}
                                className="flex flex-col items-center gap-1"
                                style={{
                                    opacity: phase >= 2 ? 1 : 0,
                                    transform: phase >= 2 ? "translateY(0px)" : "translateY(10px)",
                                    transition: `opacity 0.28s ease ${i * 0.06}s, transform 0.34s cubic-bezier(0.34,1.4,0.64,1) ${i * 0.06}s`,
                                }}
                            >
                                <div className="relative">
                                    <Ring
                                        pct={s.value}
                                        size={44}
                                        stroke={4}
                                        color={s.color}
                                        animate={show}
                                        delay={200 + i * 70}
                                    />
                                    <span
                                        className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                                        style={{ color: s.color }}
                                    >
                                        {s.value}%
                                    </span>
                                </div>
                                <span className="text-[9px] text-muted-foreground text-center leading-tight whitespace-nowrap">
                                    {s.label}
                                </span>
                            </div>
                        ))}

                        {/* Overall bar — inline after rings */}
                        <div
                            className="flex-1 ms-2"
                            style={{
                                opacity: phase >= 2 ? 1 : 0,
                                transition: "opacity 0.3s ease 0.3s",
                                minWidth: "90px",
                            }}
                        >
                            <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="text-muted-foreground font-medium">Overall</span>
                                <span className="font-bold" style={{ color: overallColor }}>{overall}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: phase >= 3 ? `${overall}%` : "0%",
                                        background: `linear-gradient(90deg, ${overallColor}99, ${overallColor})`,
                                        transition: "width 0.65s cubic-bezier(0.4,0,0.2,1) 0s",
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
