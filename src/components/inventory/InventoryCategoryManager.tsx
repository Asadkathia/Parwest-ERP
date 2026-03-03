"use client"

import { useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Row = {
  id: string
  name: string
  createdAt: string
}

export default function InventoryCategoryManager() {
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback
  const [rows, setRows] = useState<Row[]>([])
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const loadRows = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/inventory/categories")
      if (!response.ok) throw new Error("Failed to fetch categories")
      const data = await response.json()
      setRows(data || [])
    } catch (error) {
      console.error(error)
      setNotice({ type: "error", message: "Unable to fetch categories." })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadRows()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const reset = () => {
    setName("")
    setEditingId(null)
  }

  const save = async () => {
    if (!name.trim()) {
      setNotice({ type: "error", message: "Category name is required." })
      return
    }
    try {
      const response = await fetch(
        editingId ? `/api/inventory/categories/${editingId}` : "/api/inventory/categories",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      )
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || "Save failed")
      }
      setNotice({ type: "success", message: editingId ? "Category updated." : "Category created." })
      reset()
      await loadRows()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Unable to save category.") })
    }
  }

  const remove = async (id: string) => {
    try {
      const response = await fetch(`/api/inventory/categories/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || "Delete failed")
      }
      setNotice({ type: "success", message: "Category deleted." })
      await loadRows()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Unable to delete category.") })
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Define Categories" subtitle="Backend-connected category management." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4 space-y-3">
        <label className="space-y-1 block">
          <span className="text-xs text-[var(--text-muted)]">Category Name</span>
          <input className="ui-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="WEAPON / UNIFORM / EQUIPMENT / AMMUNITION" />
        </label>
        <div className="flex gap-2 justify-end">
          <ActionButton variant="secondary" onClick={reset}>Reset</ActionButton>
          <ActionButton onClick={save}>{editingId ? "Update" : "Create"}</ActionButton>
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[760px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Name</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Created At</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No categories found.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm">{row.name}</td>
                  <td className="px-4 py-3 text-sm">{new Date(row.createdAt).toLocaleDateString("en-US")}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <ActionButton variant="secondary" onClick={() => { setEditingId(row.id); setName(row.name) }}>Edit</ActionButton>
                      <ActionButton variant="danger" onClick={() => remove(row.id)}>Delete</ActionButton>
                    </div>
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
