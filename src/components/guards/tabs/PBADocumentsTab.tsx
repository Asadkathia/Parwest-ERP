"use client"

import { FileText, Eye, Download, ShieldCheck } from "lucide-react"
import type { GuardTabModel } from "@/components/guards/tabs/types"

interface PBADocumentsTabProps {
    guard: GuardTabModel & { id?: string }
}

// ── document card config ──────────────────────────────────────────────────────
// Slugs match `DOC_GENERATORS` in
// `src/app/api/guards/[id]/system-doc/[docType]/route.ts`. View/download
// targets the same audit-logged server route the rest of the system docs use.
/* eslint-disable no-restricted-syntax -- per-document-type accent palettes used as inline styles for PDF/print rendering; kept as discrete color tuples */
const PBA_DOCS = [
    {
        id: "SA05",
        slug: "sa05",
        title: "Particulars & Documents",
        subtitle: "Guards / Supervisors — PBA Records",
        accent: "#0d9488",
        accentLight: "#f0fdfa",
        accentBorder: "#99f6e4",
        iconBg: "#ccfbf1",
        visibility: "all" as const,
    },
    {
        id: "SA10",
        slug: "sa10",
        title: "Ex-Servicemen Particulars",
        subtitle: "Armed / Para Military Forces — PBA Records",
        accent: "#059669",
        accentLight: "#f0fdf4",
        accentBorder: "#a7f3d0",
        iconBg: "#d1fae5",
        visibility: "exservice" as const,   // only for ex-servicemen
    },
    {
        id: "SA11",
        slug: "sa11",
        title: "Verification Status",
        subtitle: "Guard Particulars — PBA Records",
        accent: "#7c3aed",
        accentLight: "#f5f3ff",
        accentBorder: "#ddd6fe",
        iconBg: "#ede9fe",
        visibility: "civilian" as const,    // only for civilians
    },
]
/* eslint-enable no-restricted-syntax */

// Determine if a guard is ex-service from any source.
function isExServiceGuard(guard: GuardTabModel & { id?: string }): boolean {
    const prevEmps = (guard as Record<string, unknown>).previousEmployments
    if (Array.isArray(prevEmps) && prevEmps.length > 0) {
        return prevEmps.some((e: Record<string, unknown>) => e.isExService === true)
    }
    if (guard.isExService) return true
    if (guard.exServiceType && guard.exServiceType !== "CIVILIAN") return true
    return false
}

// ── main component ────────────────────────────────────────────────────────────
export default function PBADocumentsTab({ guard }: PBADocumentsTabProps) {
    const exService = isExServiceGuard(guard)
    const guardId = guard.id

    const buildUrl = (slug: string, action: "view" | "download") =>
        guardId ? `/api/guards/${encodeURIComponent(guardId)}/system-doc/${slug}?action=${action}` : "#"

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">PBA Documents</h2>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    PBA Compliance Documents
                </div>
            </div>

            {/* Guard type info banner */}
            <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                exService
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-violet-200 bg-violet-50 text-violet-700"
            }`}>
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>
                    Guard type: <strong>{exService ? "Ex-Serviceman" : "Civilian"}</strong>.
                    {exService ? " SA-05 + SA-10 are applicable." : " SA-05 + SA-11 are applicable."}
                </span>
            </div>

            {/* Document cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                {PBA_DOCS.map((doc) => {
                    if (doc.visibility === "exservice" && !exService) return null
                    if (doc.visibility === "civilian" && exService) return null

                    const viewUrl = buildUrl(doc.slug, "view")
                    const downloadUrl = buildUrl(doc.slug, "download")
                    const disabled = !guardId

                    return (
                        <div
                            key={doc.id}
                            className="relative flex flex-col rounded-xl border bg-white overflow-hidden transition-shadow"
                            style={{
                                borderColor: doc.accentBorder,
                                boxShadow: `0 1px 8px 0 ${doc.accentBorder}88`,
                            }}
                        >
                            {/* Colour accent strip */}
                            <div className="h-1.5 w-full" style={{ background: doc.accent }} />

                            {/* Card body */}
                            <div className="flex flex-col gap-3 p-5">
                                <div className="flex items-start justify-between">
                                    <div
                                        className="flex h-11 w-11 items-center justify-center rounded-xl"
                                        style={{ background: doc.iconBg }}
                                    >
                                        <FileText className="h-5 w-5" style={{ color: doc.accent }} />
                                    </div>
                                    <span
                                        className="rounded-md px-2 py-0.5 text-xs font-bold tracking-wide"
                                        style={{
                                            background: doc.accentLight,
                                            color: doc.accent,
                                            border: `1px solid ${doc.accentBorder}`,
                                        }}
                                    >
                                        PBA-{doc.id}
                                    </span>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-gray-800 leading-snug">{doc.title}</p>
                                    <p className="mt-0.5 text-[11px] text-gray-400 leading-snug">{doc.subtitle}</p>
                                </div>

                                {/* Action buttons (anchor tags — no popup-blocker issues) */}
                                <div className="flex gap-2 pt-1">
                                    <a
                                        href={viewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-disabled={disabled}
                                        onClick={(e) => { if (disabled) e.preventDefault() }}
                                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${disabled ? "opacity-50 pointer-events-none" : ""}`}
                                        style={{ borderColor: doc.accentBorder, color: doc.accent, background: doc.accentLight }}
                                    >
                                        <Eye className="h-3.5 w-3.5" />
                                        View
                                    </a>
                                    <a
                                        href={downloadUrl}
                                        download={`PBA-${doc.id}-${guard.parwestId ?? "guard"}.html`}
                                        aria-disabled={disabled}
                                        onClick={(e) => { if (disabled) e.preventDefault() }}
                                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity ${disabled ? "opacity-50 pointer-events-none" : ""}`}
                                        style={{ background: doc.accent }}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </a>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Missing references hint */}
            {(!guard.nearestRelatives || guard.nearestRelatives.length === 0) && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                    Tip: Reference fields in SA-10 and SA-11 will be empty until Nearest Relatives are added to this guard&apos;s profile.
                </p>
            )}
        </div>
    )
}
