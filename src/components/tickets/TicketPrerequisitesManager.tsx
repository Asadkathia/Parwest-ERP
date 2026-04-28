"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Edit3, Check, X, Settings } from "lucide-react"
import InlineAlert from "@/components/ui/inline-alert"

type Item = { id: string; name: string; description?: string | null; color?: string | null }
type Tab = "Categories" | "Priorities" | "Statuses"

const TABS: Tab[] = ["Categories", "Priorities", "Statuses"]
const endpoint = (t: Tab) => t === "Categories" ? "/api/tickets/categories" : t === "Priorities" ? "/api/tickets/priorities" : "/api/tickets/statuses"
const singular = (t: Tab) => t.slice(0, -1)

// eslint-disable-next-line no-restricted-syntax -- color palette presented to admin in <input type="color"> swatch picker; persisted as DB data, not UI styling
const DEFAULT_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#6366f1","#8b5cf6","#ec4899","#94a3b8"]

export default function TicketPrerequisitesManager() {
  const [activeTab, setActiveTab] = useState<Tab>("Categories")
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  // Add form
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  // eslint-disable-next-line no-restricted-syntax -- default seed color persisted to DB, not UI styling
  const [newColor, setNewColor] = useState("#3b82f6")
  const [adding, setAdding] = useState(false)

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editColor, setEditColor] = useState("")
  const [saving, setSaving] = useState(false)

  const load = async (tab: Tab) => {
    setLoading(true); setError("")
    try {
      const res = await fetch(endpoint(tab), { cache: "no-store" })
      const data = await res.json().catch(()=>[])
      setItems(Array.isArray(data) ? data : [])
    } catch { setError("Failed to load.") }
    finally { setLoading(false) }
  }

  useEffect(() => { void load(activeTab) }, [activeTab])

  const handleAdd = async () => {
    if (!newName.trim()) { setError("Name is required."); return }
    setAdding(true); setError(""); setNotice("")
    try {
      const body: Record<string,string> = { name: newName.trim(), color: newColor }
      if (activeTab === "Categories" && newDesc.trim()) body.description = newDesc.trim()
      const res = await fetch(endpoint(activeTab), { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.message || "Failed to add.")
      setNotice(`${singular(activeTab)} added.`)
      // eslint-disable-next-line no-restricted-syntax -- reset to default seed color value (DB data)
      setNewName(""); setNewDesc(""); setNewColor("#3b82f6")
      await load(activeTab)
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add.") }
    finally { setAdding(false) }
  }

  const startEdit = (item: Item) => {
    setEditId(item.id)
    setEditName(item.name)
    setEditDesc(item.description ?? "")
    // eslint-disable-next-line no-restricted-syntax -- fallback to default seed color (DB data)
    setEditColor(item.color ?? "#3b82f6")
  }

  const cancelEdit = () => setEditId(null)

  const handleSave = async (id: string) => {
    if (!editName.trim()) return
    setSaving(true); setError(""); setNotice("")
    try {
      const body: Record<string,string|null> = { name: editName.trim(), color: editColor || null }
      if (activeTab === "Categories") body.description = editDesc.trim() || null
      const res = await fetch(`${endpoint(activeTab)}/${id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.message || "Failed to save.")
      setNotice(`${singular(activeTab)} updated.`); setEditId(null)
      await load(activeTab)
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save.") }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setError(""); setNotice("")
    try {
      const res = await fetch(`${endpoint(activeTab)}/${id}`, { method: "DELETE" })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.message || "Failed to delete.")
      setNotice(`${singular(activeTab)} deleted.`)
      await load(activeTab)
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to delete.") }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-[var(--brand)]" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Ticket Prerequisites</h1>
          <p className="text-sm text-[var(--text-muted)]">Configure categories, priorities, and statuses for the ticketing system</p>
        </div>
      </div>

      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)]">
        {TABS.map(tab => (
          <button key={tab} onClick={()=>setActiveTab(tab)} className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${activeTab===tab ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Add Form */}
      <div className="ui-card p-5">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2"><Plus className="h-4 w-4 text-[var(--brand)]" /> Add New {singular(activeTab)}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Name <span className="text-red-500">*</span></label>
            <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void handleAdd()} className="ui-input" placeholder={`${singular(activeTab)} name...`} />
          </div>
          {activeTab === "Categories" ? (
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Description</label>
              <input value={newDesc} onChange={e=>setNewDesc(e.target.value)} className="ui-input" placeholder="Optional description..." />
            </div>
          ) : <div />}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} className="h-9 w-12 rounded border border-[var(--border)] cursor-pointer" />
              <div className="flex flex-wrap gap-1">
                {DEFAULT_COLORS.map(c => (
                  <button key={c} type="button" onClick={()=>setNewColor(c)} className={`h-5 w-5 rounded-full border-2 transition ${newColor===c?"border-[var(--text)] scale-110":"border-transparent"}`} style={{background:c}} />
                ))}
              </div>
            </div>
          </div>
          <button onClick={()=>void handleAdd()} disabled={adding||!newName.trim()} className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition h-9">
            <Plus className="h-4 w-4" /> {adding?"Adding...":"Add"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="ui-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-muted)]">
          <p className="text-sm font-semibold text-[var(--text)]">{activeTab} <span className="text-[var(--text-muted)] font-normal ml-1">({items.length})</span></p>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-[var(--text-muted)]">Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--text-muted)]">No {activeTab.toLowerCase()} configured yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {items.map(item => (
              <div key={item.id} className="px-5 py-4 flex items-center gap-4 hover:bg-[var(--surface-muted)] transition-colors">
                {/* Color swatch */}
                {/* eslint-disable-next-line no-restricted-syntax -- swatch fallback for unset DB color */}
                <span className="h-8 w-8 rounded-full border-2 border-white shadow shrink-0" style={{background: item.color||"#94a3b8"}} />

                {editId === item.id ? (
                  /* Inline edit row */
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                    <input value={editName} onChange={e=>setEditName(e.target.value)} className="ui-input text-sm" autoFocus />
                    {activeTab==="Categories" && <input value={editDesc} onChange={e=>setEditDesc(e.target.value)} className="ui-input text-sm" placeholder="Description..." />}
                    <div className="flex items-center gap-2">
                      <input type="color" value={editColor} onChange={e=>setEditColor(e.target.value)} className="h-8 w-10 rounded border border-[var(--border)] cursor-pointer" />
                      <button onClick={()=>void handleSave(item.id)} disabled={saving} className="inline-flex items-center gap-1 rounded px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50">
                        <Check className="h-3 w-3" /> Save
                      </button>
                      <button onClick={cancelEdit} className="inline-flex items-center gap-1 rounded px-3 py-1.5 border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]">
                        <X className="h-3 w-3" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display row */
                  <div className="flex-1 flex items-center gap-4 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-[var(--text)]">{item.name}</p>
                      {item.description && <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{item.description}</p>}
                    </div>
                    <span className="text-xs text-[var(--text-muted)] font-mono shrink-0">{item.color||"—"}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={()=>startEdit(item)} className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition">
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                      <button onClick={()=>void handleDelete(item.id, item.name)} className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition">
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}