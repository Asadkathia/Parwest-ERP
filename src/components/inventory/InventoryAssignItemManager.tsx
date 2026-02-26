"use client"

import { useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Item = { id: string; uniqueNumber: string; status: string }
type Guard = { id: string; name: string; parwestId: string }
type Client = { id: string; name: string }
type Assignment = {
  id: string
  assignedAt: string
  returnedAt: string | null
  item: { id: string; uniqueNumber: string }
  guard: { id: string; name: string; parwestId: string } | null
  client: { id: string; name: string } | null
}

export default function InventoryAssignItemManager() {
  const [items, setItems] = useState<Item[]>([])
  const [guards, setGuards] = useState<Guard[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [rows, setRows] = useState<Assignment[]>([])
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [form, setForm] = useState({ assignTo: "GUARD", itemId: "", entityId: "", notes: "" })

  const load = async () => {
    const [itemsRes, guardsRes, clientsRes, assignmentsRes] = await Promise.all([
      fetch("/api/inventory/items?status=AVAILABLE"),
      fetch("/api/guards?status=ACTIVE"),
      fetch("/api/clients?status=ACTIVE"),
      fetch("/api/inventory/assignments"),
    ])
    if (itemsRes.ok) setItems(await itemsRes.json())
    if (guardsRes.ok) setGuards(await guardsRes.json())
    if (clientsRes.ok) setClients(await clientsRes.json())
    if (assignmentsRes.ok) setRows(await assignmentsRes.json())
  }

  useEffect(() => {
    load().catch(() => null)
  }, [])

  const submit = async () => {
    if (!form.itemId || !form.entityId) {
      setNotice({ type: "error", message: "Item and target entity are required." })
      return
    }
    const response = await fetch("/api/inventory/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setNotice({ type: "error", message: body?.message || "Failed to assign item." })
      return
    }
    setNotice({ type: "success", message: "Item assigned successfully." })
    setForm({ assignTo: "GUARD", itemId: "", entityId: "", notes: "" })
    await load()
  }

  const markReturn = async (id: string) => {
    const response = await fetch(`/api/inventory/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnedAt: new Date().toISOString() }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setNotice({ type: "error", message: body?.message || "Failed to mark return." })
      return
    }
    setNotice({ type: "success", message: "Item marked returned." })
    await load()
  }

  const assigneeOptions =
    form.assignTo === "GUARD"
      ? guards.map((g) => ({ id: g.id, label: `${g.parwestId} - ${g.name}` }))
      : clients.map((c) => ({ id: c.id, label: c.name }))

  return (
    <div className="space-y-6">
      <SectionTitle title="Assign Item" subtitle="Checkout inventory to guard/client with return tracking." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select className="ui-select" value={form.assignTo} onChange={(e) => setForm((p) => ({ ...p, assignTo: e.target.value as "GUARD" | "CLIENT", entityId: "" }))}>
            <option value="GUARD">Assign to Guard</option>
            <option value="CLIENT">Assign to Client</option>
          </select>
          <select className="ui-select" value={form.itemId} onChange={(e) => setForm((p) => ({ ...p, itemId: e.target.value }))}>
            <option value="">Select Item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.uniqueNumber}</option>
            ))}
          </select>
          <select className="ui-select" value={form.entityId} onChange={(e) => setForm((p) => ({ ...p, entityId: e.target.value }))}>
            <option value="">Select {form.assignTo === "GUARD" ? "Guard" : "Client"}</option>
            {assigneeOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <input className="ui-input" placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </div>
        <div className="mt-4 flex justify-end">
          <ActionButton onClick={submit}>Checkout</ActionButton>
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[980px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Item</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Assigned To</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Assigned At</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Returned At</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No assignments found.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm">{row.item?.uniqueNumber || "—"}</td>
                  <td className="px-4 py-3 text-sm">{row.guard ? `${row.guard.parwestId} - ${row.guard.name}` : row.client?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{new Date(row.assignedAt).toLocaleDateString("en-US")}</td>
                  <td className="px-4 py-3 text-sm">{row.returnedAt ? new Date(row.returnedAt).toLocaleDateString("en-US") : "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {!row.returnedAt ? (
                      <ActionButton variant="secondary" onClick={() => markReturn(row.id)}>Mark Returned</ActionButton>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Returned</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
