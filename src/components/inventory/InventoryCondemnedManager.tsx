"use client"

import { useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Item = {
  id: string
  uniqueNumber: string
  serialNumber: string | null
  status: string
  category: { id: string; name: string }
  vendor: { id: string; name: string } | null
}

export default function InventoryCondemnedManager() {
  const [rows, setRows] = useState<Item[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = async () => {
    const response = await fetch("/api/inventory/items")
    if (!response.ok) {
      setRows([])
      return
    }
    const data = await response.json()
    setRows(data || [])
  }

  useEffect(() => {
    load().catch(() => null)
  }, [])

  const markCondemned = async () => {
    if (!selectedId) {
      setNotice({ type: "error", message: "Select an item first." })
      return
    }
    const response = await fetch(`/api/inventory/items/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONDEMNED" }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setNotice({ type: "error", message: body?.message || "Failed to update item status." })
      return
    }
    setNotice({ type: "success", message: "Item marked as condemned." })
    setSelectedId("")
    await load()
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Condemned Items" subtitle="Mark inventory items as condemned." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <select className="ui-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Select Item</option>
            {rows.filter((r) => r.status !== "CONDEMNED").map((row) => (
              <option key={row.id} value={row.id}>{row.uniqueNumber}</option>
            ))}
          </select>
          <div className="flex justify-end">
            <ActionButton variant="danger" onClick={markCondemned}>Mark as Condemned</ActionButton>
          </div>
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[980px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Unique #</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Serial #</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Category</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Vendor</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No inventory items found.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm">{row.uniqueNumber}</td>
                  <td className="px-4 py-3 text-sm">{row.serialNumber || "—"}</td>
                  <td className="px-4 py-3 text-sm">{row.category?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{row.vendor?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
