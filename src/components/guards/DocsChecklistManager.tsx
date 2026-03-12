"use client"

import { useEffect, useMemo, useState } from "react"
import { Printer, Search, Plus, Minus } from "lucide-react"

const STANDARD_DOC_TYPES = [
  "CNIC Copy",
  "Photo (3x4)",
  "Police Verification Certificate",
  "Guard Contract / Agreement",
  "Employment Form",
  "Medical Certificate",
  "NOC (Previous Employer)",
  "Academic Certificates",
  "Training Certificate",
  "Character Certificate",
  "Domicile Certificate",
  "Bank Account Details",
]

type DocSelection = { name: string; selected: boolean }

type GuardDocRow = {
  id: string
  parwestId: string
  name: string
  cnic: string
  selected: boolean
  overrideDocs: DocSelection[] | null // null = use global docs
}

type GuardListApiRow = {
  id: string
  parwestId?: string | null
  name?: string | null
  cnic?: string | null
}

const PAGE_SIZES = [10, 20, 50, 100, 200, "All"] as const
type PageSize = (typeof PAGE_SIZES)[number]

function makeDefaultDocs(selected = false): DocSelection[] {
  return STANDARD_DOC_TYPES.map((name) => ({ name, selected }))
}

export default function DocsChecklistManager() {
  const [allRows, setAllRows] = useState<GuardDocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Step 1 — global doc selection
  const [globalDocs, setGlobalDocs] = useState<DocSelection[]>(makeDefaultDocs(false))

  // Step 2 — guard selection
  const [search, setSearch] = useState("")
  const [pageSize, setPageSize] = useState<PageSize>(10)

  // Expandable per-guard panel
  const [expandedGuardId, setExpandedGuardId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const res = await fetch("/api/guards", { cache: "no-store" })
        const payload: unknown = await res.json().catch(() => null)
        if (!res.ok) {
          const msg =
            payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Failed to load guards."
          throw new Error(msg)
        }
        const guards = Array.isArray(payload) ? (payload as GuardListApiRow[]) : []
        const mapped: GuardDocRow[] = guards.map((g) => ({
          id: g.id,
          parwestId: String(g.parwestId || "N/A"),
          name: String(g.name || "Unnamed Guard"),
          cnic: String(g.cnic || "—"),
          selected: false,
          overrideDocs: null,
        }))
        if (!mounted) return
        setAllRows(mapped)
      } catch (err: unknown) {
        if (!mounted) return
        setAllRows([])
        setLoadError(err instanceof Error ? err.message : "Failed to load guards.")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const effectiveDocs = (guard: GuardDocRow) =>
    guard.overrideDocs ?? globalDocs

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allRows
    return allRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.parwestId.toLowerCase().includes(q) ||
        r.cnic.toLowerCase().includes(q)
    )
  }, [allRows, search])

  const visibleRows = useMemo(
    () => (pageSize === "All" ? filteredRows : filteredRows.slice(0, pageSize as number)),
    [filteredRows, pageSize]
  )

  const selectedGuards = useMemo(() => allRows.filter((r) => r.selected), [allRows])

  const globalSelectedCount = globalDocs.filter((d) => d.selected).length

  const printItems = useMemo(
    () =>
      selectedGuards.flatMap((g) =>
        effectiveDocs(g)
          .filter((d) => d.selected)
          .map((d) => ({ parwestId: g.parwestId, guardName: g.name, cnic: g.cnic, docName: d.name }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedGuards, globalDocs]
  )

  // ── Step 1: Global doc toggle ──────────────────────────────────────────────

  const toggleGlobalDoc = (name: string) =>
    setGlobalDocs((prev) => prev.map((d) => (d.name === name ? { ...d, selected: !d.selected } : d)))

  const setAllGlobalDocs = (value: boolean) =>
    setGlobalDocs((prev) => prev.map((d) => ({ ...d, selected: value })))

  // ── Step 2: Guard toggle ───────────────────────────────────────────────────

  const toggleGuard = (id: string) =>
    setAllRows((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)))

  const selectAllVisible = (value: boolean) => {
    const ids = new Set(visibleRows.map((r) => r.id))
    setAllRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, selected: value } : r)))
  }

  // ── Per-guard doc override ─────────────────────────────────────────────────

  const toggleOverrideDoc = (guardId: string, docName: string) => {
    setAllRows((prev) =>
      prev.map((r) => {
        if (r.id !== guardId) return r
        // initialise override from current effective docs if not set
        const base = r.overrideDocs ?? globalDocs.map((d) => ({ ...d }))
        const updated = base.map((d) => (d.name === docName ? { ...d, selected: !d.selected } : d))
        return { ...r, overrideDocs: updated }
      })
    )
  }

  const resetOverride = (guardId: string) =>
    setAllRows((prev) => prev.map((r) => (r.id === guardId ? { ...r, overrideDocs: null } : r)))

  // ── Print ──────────────────────────────────────────────────────────────────

  const doPrint = () => {
    if (printItems.length === 0) return
    const bodyRows = printItems
      .map(
        (item) =>
          `<tr><td>${item.parwestId}</td><td>${item.guardName}</td><td>${item.cnic}</td><td>${item.docName}</td></tr>`
      )
      .join("")

    const html = `<html><head><title>Guard Documents Checklist</title>
      <style>
        body{font-family:Arial,sans-serif;margin:24px;color:#111827}
        h1{margin:0 0 6px;font-size:20px}
        p.meta{margin:0 0 16px;color:#4b5563;font-size:13px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #d1d5db;padding:7px 10px;text-align:left;font-size:13px}
        th{background:#f3f4f6;font-weight:600}
      </style></head>
      <body>
        <h1>Guard Documents Checklist</h1>
        <p class="meta">Total rows: ${printItems.length} &nbsp;|&nbsp; Guards: ${selectedGuards.length}</p>
        <table>
          <thead><tr><th>Parwest ID</th><th>Guard Name</th><th>CNIC</th><th>Document</th></tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body></html>`

    const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800")
    if (!popup) return
    popup.document.open()
    popup.document.write(html)
    popup.document.close()
    setTimeout(() => { popup.focus(); popup.print() }, 200)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ─── STEP 1: Select Documents ─────────────────────────────────────── */}
      <section className="ui-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">1</span>
              <h2 className="text-base font-semibold text-[var(--text)]">Select Documents to Print</h2>
            </div>
            <p className="mt-0.5 ml-8 text-sm text-[var(--text-muted)]">
              Choose which documents should be printed for every selected guard.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => setAllGlobalDocs(true)}>
              Select All
            </button>
            <button type="button" className="text-[var(--text-muted)] hover:underline" onClick={() => setAllGlobalDocs(false)}>
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {globalDocs.map((doc) => (
            <label
              key={doc.name}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                doc.selected
                  ? "border-[var(--brand)] bg-[var(--brand)]/8 text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)]/50"
              }`}
            >
              <input
                type="checkbox"
                checked={doc.selected}
                onChange={() => toggleGlobalDoc(doc.name)}
                className="accent-[var(--brand)]"
              />
              <span className="leading-snug">{doc.name}</span>
            </label>
          ))}
        </div>

        {globalSelectedCount > 0 && (
          <p className="mt-3 text-sm font-medium text-[var(--brand)]">
            {globalSelectedCount} document{globalSelectedCount !== 1 ? "s" : ""} selected
          </p>
        )}
      </section>

      {/* ─── STEP 2: Select Guards ────────────────────────────────────────── */}
      <section className="ui-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">2</span>
            <h2 className="text-base font-semibold text-[var(--text)]">Select Guards</h2>
          </div>
          <p className="ml-8 text-sm text-[var(--text-muted)]">
            Select which guards to include in the bulk print.
          </p>
        </div>

        {/* Search + page-size bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3 bg-[var(--surface-muted)]">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, Parwest ID or CNIC…"
              className="ui-input pl-8 py-1.5 text-sm w-full"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-[var(--text-muted)] mr-1">Show:</span>
            {PAGE_SIZES.map((size) => (
              <button
                key={String(size)}
                type="button"
                onClick={() => setPageSize(size)}
                className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors ${
                  pageSize === size
                    ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="text-xs text-[var(--brand)] hover:underline" onClick={() => selectAllVisible(true)}>
              Select All
            </button>
            <button type="button" className="text-xs text-[var(--text-muted)] hover:underline" onClick={() => selectAllVisible(false)}>
              Clear
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="w-10 px-4 py-2"></th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Parwest ID</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Guard Name</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">CNIC</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Docs</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Customise</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Loading guards…</td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    {loadError ? `Error: ${loadError}` : search ? "No guards match your search." : "No guards found."}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const docs = effectiveDocs(row)
                  const selCount = docs.filter((d) => d.selected).length
                  const isExpanded = expandedGuardId === row.id
                  const hasOverride = row.overrideDocs !== null

                  return [
                    <tr
                      key={row.id}
                      className={`border-t border-[var(--border)] cursor-pointer hover:bg-[var(--surface-muted)] ${row.selected ? "bg-[var(--brand)]/5" : ""}`}
                      onClick={() => toggleGuard(row.id)}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleGuard(row.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-[var(--brand)]"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm font-mono">{row.parwestId}</td>
                      <td className="px-4 py-2 text-sm font-medium">{row.name}</td>
                      <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{row.cnic}</td>
                      <td className="px-4 py-2 text-sm">
                        {row.selected ? (
                          <span className={selCount > 0 ? "font-medium text-[var(--brand)]" : "text-[var(--text-muted)]"}>
                            {selCount} / {docs.length}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm" onClick={(e) => e.stopPropagation()}>
                        {row.selected && (
                          <button
                            type="button"
                            onClick={() => setExpandedGuardId(isExpanded ? null : row.id)}
                            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs border transition-colors ${
                              isExpanded
                                ? "border-[var(--brand)] text-[var(--brand)] bg-[var(--brand)]/8"
                                : hasOverride
                                ? "border-amber-400 text-amber-700 bg-amber-50"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
                            }`}
                          >
                            {isExpanded ? <Minus size={11} /> : <Plus size={11} />}
                            {hasOverride ? "Custom" : "Customise"}
                          </button>
                        )}
                      </td>
                    </tr>,

                    // Inline expanded override panel
                    isExpanded && row.selected ? (
                      <tr key={`${row.id}-expand`} className="border-t border-[var(--border)] bg-[var(--surface-muted)]">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">
                              Custom documents for {row.name}
                            </p>
                            <div className="flex gap-3 text-xs">
                              {hasOverride && (
                                <button
                                  type="button"
                                  className="text-amber-700 hover:underline"
                                  onClick={() => { resetOverride(row.id); setExpandedGuardId(null) }}
                                >
                                  Reset to global
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {docs.map((doc) => (
                              <label
                                key={doc.name}
                                className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs transition-colors ${
                                  doc.selected
                                    ? "border-[var(--brand)] bg-[var(--brand)]/8 text-[var(--text)]"
                                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)]/50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={doc.selected}
                                  onChange={() => toggleOverrideDoc(row.id, doc.name)}
                                  className="accent-[var(--brand)]"
                                />
                                <span>{doc.name}</span>
                              </label>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ]
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredRows.length > 0 && (
          <p className="px-4 py-2 text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
            Showing {visibleRows.length} of {filteredRows.length} guards
            {allRows.length !== filteredRows.length ? ` (filtered from ${allRows.length})` : ""}
            &nbsp;·&nbsp;
            <span className={selectedGuards.length > 0 ? "font-medium text-[var(--brand)]" : ""}>
              {selectedGuards.length} selected
            </span>
          </p>
        )}
      </section>

      {/* ─── Print bar ────────────────────────────────────────────────────── */}
      <section className="ui-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[var(--text-muted)]">
            {printItems.length > 0 ? (
              <span>
                Ready to print <span className="font-semibold text-[var(--text)]">{printItems.length}</span> document row{printItems.length !== 1 ? "s" : ""} across{" "}
                <span className="font-semibold text-[var(--text)]">{selectedGuards.length}</span> guard{selectedGuards.length !== 1 ? "s" : ""}.
              </span>
            ) : (
              "Select documents in Step 1 and guards in Step 2 to enable printing."
            )}
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2"
            disabled={printItems.length === 0}
            onClick={doPrint}
          >
            <Printer size={15} />
            Print Checklist
            {printItems.length > 0 && (
              <span className="rounded-full bg-white/30 px-2 py-0.5 text-xs">{printItems.length}</span>
            )}
          </button>
        </div>
      </section>

    </div>
  )
}
