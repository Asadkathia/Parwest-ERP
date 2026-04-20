"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Ticket, Send } from "lucide-react"
import InlineAlert from "@/components/ui/inline-alert"

type Lookup = { id: string; name: string; color?: string | null }
type User = { id: string; name: string; email?: string | null }

export default function TicketNewManager() {
  const router = useRouter()
  const [categories, setCategories] = useState<Lookup[]>([])
  const [priorities, setPriorities] = useState<Lookup[]>([])
  const [statuses, setStatuses] = useState<Lookup[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [priorityId, setPriorityId] = useState("")
  const [statusId, setStatusId] = useState("")
  const [assignedToId, setAssignedToId] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/tickets/categories").then(r=>r.json()).catch(()=>[]),
      fetch("/api/tickets/priorities").then(r=>r.json()).catch(()=>[]),
      fetch("/api/tickets/statuses").then(r=>r.json()).catch(()=>[]),
      fetch("/api/users").then(r=>r.json()).catch(()=>[]),
    ]).then(([c,p,s,u]) => {
      const cats = Array.isArray(c) ? c : []
      const prios = Array.isArray(p) ? p : []
      const stats = Array.isArray(s) ? s : []
      const usrs = Array.isArray(u) ? u : []
      setCategories(cats)
      setPriorities(prios)
      setStatuses(stats)
      setUsers(usrs)
      // Auto-select first status that looks like "open" or "new"
      const defaultStatus = stats.find(st => ["new","open","pending"].includes(st.name.toLowerCase())) || stats[0]
      if (defaultStatus) setStatusId(defaultStatus.id)
      // Auto-select "Normal" priority
      const defaultPrio = prios.find(p2 => p2.name.toLowerCase() === "normal") || prios[0]
      if (defaultPrio) setPriorityId(defaultPrio.id)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !categoryId || !priorityId || !statusId) {
      setError("Subject, Category, Priority and Status are required.")
      return
    }
    setSubmitting(true); setError(""); setNotice("")
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), description: description || null, categoryId, priorityId, statusId, assignedToId: assignedToId || null }),
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.message || "Failed to create ticket.")
      router.push(`/tickets/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket.")
    } finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={()=>router.back()} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
            <Ticket className="h-6 w-6 text-[var(--brand)]" /> New Ticket
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Submit a new support ticket to the admin</p>
        </div>
      </div>

      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Subject */}
        <div className="ui-card p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text)] border-b border-[var(--border)] pb-2">Ticket Details</h2>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Subject <span className="text-red-500">*</span></label>
            <input
              value={subject}
              onChange={e=>setSubject(e.target.value)}
              className="ui-input"
              placeholder="Brief description of the issue..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e=>setDescription(e.target.value)}
              className="ui-textarea min-h-[120px]"
              placeholder="Provide full details about the issue, steps to reproduce, screenshots references, etc."
            />
          </div>
        </div>

        {/* Classification */}
        <div className="ui-card p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text)] border-b border-[var(--border)] pb-2">Classification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Category <span className="text-red-500">*</span></label>
              <select className="ui-select" value={categoryId} onChange={e=>setCategoryId(e.target.value)} required>
                <option value="">Select category...</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {categories.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No categories configured. <Link href="/tickets/prerequisites" className="underline">Add categories →</Link></p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Priority <span className="text-red-500">*</span></label>
              <select className="ui-select" value={priorityId} onChange={e=>setPriorityId(e.target.value)} required>
                <option value="">Select priority...</option>
                {priorities.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Status <span className="text-red-500">*</span></label>
              <select className="ui-select" value={statusId} onChange={e=>setStatusId(e.target.value)} required>
                <option value="">Select status...</option>
                {statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Assign To</label>
              <select className="ui-select" value={assignedToId} onChange={e=>setAssignedToId(e.target.value)}>
                <option value="">Leave unassigned</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ""}</option>)}
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-1">Admin can re-assign anytime from the ticket detail page.</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || !subject.trim() || !categoryId || !priorityId || !statusId}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting..." : "Submit Ticket"}
          </button>
          <button type="button" onClick={()=>router.back()} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}