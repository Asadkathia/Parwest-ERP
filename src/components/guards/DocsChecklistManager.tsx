"use client"

import { useMemo, useState } from "react"
import { mockGuardsList } from "@/lib/mockData"

type SubmittedDoc = {
  id: string
  name: string
  type?: string
  url?: string
  selected: boolean
}

type GuardDocRow = {
  id: string
  parwestId: string
  name: string
  selected: boolean
  submittedDocs: SubmittedDoc[]
}

export default function DocsChecklistManager() {
  const [rows, setRows] = useState<GuardDocRow[]>(() =>
    mockGuardsList.slice(0, 20).map((guard) => {
      const submitted = ((guard as { attachments?: Array<{ id?: string; name?: string; type?: string; url?: string }> }).attachments || []).map((doc, index) => ({
        id: String(doc.id || `${guard.id}-doc-${index + 1}`),
        name: doc.name || `Document ${index + 1}`,
        type: doc.type,
        url: doc.url,
        selected: false,
      }))

      return {
        id: guard.id,
        parwestId: guard.parwestId,
        name: guard.name,
        selected: false,
        submittedDocs: submitted,
      }
    })
  )

  const selectedGuards = useMemo(() => rows.filter((row) => row.selected), [rows])

  const selectedDocs = useMemo(
    () =>
      rows
        .filter((row) => row.selected)
        .flatMap((row) =>
          row.submittedDocs.filter((doc) => doc.selected).map((doc) => ({
            guardId: row.id,
            parwestId: row.parwestId,
            guardName: row.name,
            doc,
          }))
        ),
    [rows]
  )

  const toggleGuard = (id: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, selected: !row.selected } : row)))
  }

  const toggleDocument = (guardId: string, docId: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id !== guardId
          ? row
          : {
              ...row,
              submittedDocs: row.submittedDocs.map((doc) => (doc.id === docId ? { ...doc, selected: !doc.selected } : doc)),
            }
      )
    )
  }

  const selectAllGuards = (value: boolean) => {
    setRows((prev) => prev.map((row) => ({ ...row, selected: value })))
  }

  const selectAllDocumentsForGuard = (guardId: string, value: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id !== guardId
          ? row
          : {
              ...row,
              submittedDocs: row.submittedDocs.map((doc) => ({ ...doc, selected: value })),
            }
      )
    )
  }

  const printSelectedDocuments = () => {
    if (selectedDocs.length === 0) return

    const html = `
      <html>
        <head>
          <title>Guard Submitted Documents Print List</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 8px; font-size: 22px; }
            p.meta { margin: 0 0 20px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 13px; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Guard Submitted Documents</h1>
          <p class="meta">Selected documents count: ${selectedDocs.length}</p>
          <table>
            <thead>
              <tr>
                <th>Parwest ID</th>
                <th>Guard</th>
                <th>Document</th>
                <th>Type</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${selectedDocs
                .map(
                  (item) => `
                    <tr>
                      <td>${item.parwestId}</td>
                      <td>${item.guardName}</td>
                      <td>${item.doc.name}</td>
                      <td>${item.doc.type || "-"}</td>
                      <td>${item.doc.url ? item.doc.url : "Uploaded (mock source)"}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `

    const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800")
    if (!popup) return
    popup.document.open()
    popup.document.write(html)
    popup.document.close()
    setTimeout(() => {
      popup.focus()
      popup.print()
    }, 200)
  }

  return (
    <div className="space-y-4">
      <section className="ui-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Print Submitted Guard Documents</h2>
            <p className="text-sm text-[var(--text-muted)]">Select guards, then choose submitted documents from checklist and print.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ui-btn ui-btn-secondary px-3 py-2 text-sm" onClick={() => selectAllGuards(true)}>
              Select All Guards
            </button>
            <button type="button" className="ui-btn ui-btn-secondary px-3 py-2 text-sm" onClick={() => selectAllGuards(false)}>
              Clear Guards
            </button>
            <button type="button" className="ui-btn ui-btn-primary px-3 py-2 text-sm" disabled={selectedDocs.length === 0} onClick={printSelectedDocuments}>
              Print Selected Documents
            </button>
          </div>
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[760px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Select Guard</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Parwest ID</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Guard Name</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Submitted Documents</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
                <td className="px-4 py-2">
                  <input type="checkbox" checked={row.selected} onChange={() => toggleGuard(row.id)} />
                </td>
                <td className="px-4 py-2 text-sm">{row.parwestId}</td>
                <td className="px-4 py-2 text-sm font-medium">{row.name}</td>
                <td className="px-4 py-2 text-sm">{row.submittedDocs.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ui-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Submitted Documents Checklist</h3>

        {selectedGuards.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No guards selected.</p>
        ) : (
          selectedGuards.map((guard) => (
            <div key={guard.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text)]">
                  {guard.parwestId} - {guard.name}
                </p>
                <div className="flex gap-2">
                  <button type="button" className="text-xs text-[var(--brand)] hover:underline" onClick={() => selectAllDocumentsForGuard(guard.id, true)}>
                    Select All Docs
                  </button>
                  <button type="button" className="text-xs text-[var(--text-muted)] hover:underline" onClick={() => selectAllDocumentsForGuard(guard.id, false)}>
                    Clear
                  </button>
                </div>
              </div>

              {guard.submittedDocs.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No submitted documents found for this guard.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {guard.submittedDocs.map((doc) => (
                    <label key={doc.id} className="flex items-center justify-between gap-2 rounded border border-[var(--border)] px-3 py-2 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={doc.selected} onChange={() => toggleDocument(guard.id, doc.id)} />
                        <span>{doc.name}</span>
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">{doc.type || "Document"}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  )
}
