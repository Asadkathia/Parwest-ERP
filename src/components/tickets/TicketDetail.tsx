"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Ticket, Send, Lock, User, Clock, Tag, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react"
import InlineAlert from "@/components/ui/inline-alert"

type Lookup = { id: string; name: string; color?: string | null }
type UserRef = { id: string; name: string }
type TicketData = {
  id: string
  ticketNumber?: number | null
  subject: string
  description?: string | null
  sender?: UserRef | null
  assignedTo?: UserRef | null
  category?: Lookup | null
  priority?: Lookup | null
  status?: Lookup | null
  createdAt: string
  updatedAt: string
}
type Comment = {
  id: string
  message: string
  isInternal: boolean
  createdAt: string
  user: UserRef
}

function StatusBadge({ status }: { status?: Lookup | null }) {
  if (!status) return null
  const n = status.name.toLowerCase()
  const c = status.color || (n.includes("close") || n.includes("resolv") ? "#10b981" : n.includes("progress") ? "#f59e0b" : "#6366f1")
  const Icon = n.includes("close") || n.includes("resolv") ? CheckCircle2 : n.includes("progress") ? Clock : AlertCircle
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border" style={{ color: c, borderColor: c, backgroundColor: `${c}20` }}>
      <Icon className="h-3 w-3" />{status.name}
    </span>
  )
}

function PriorityBadge({ priority }: { priority?: Lookup | null }) {
  if (!priority) return null
  const c = priority.color || "#94a3b8"
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold border" style={{ color: c, borderColor: c, backgroundColor: `${c}20` }}>
      {priority.name}
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-white text-xs font-bold shrink-0">
      {initials}
    </span>
  )
}

export default function TicketDetail({ paramsPromise, canUpdate = true }: { paramsPromise: Promise<{ id: string }>; canUpdate?: boolean }) {
  const { id } = use(paramsPromise)
  const router = useRouter()

  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [categories, setCategories] = useState<Lookup[]>([])
  const [priorities, setPriorities] = useState<Lookup[]>([])
  const [statuses, setStatuses] = useState<Lookup[]>([])
  const [users, setUsers] = useState<UserRef[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  // Reply form
  const [message, setMessage] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [posting, setPosting] = useState(false)

  // Field updating
  const [updating, setUpdating] = useState(false)

  const loadTicket = async () => {
    try {
      const [t, c] = await Promise.all([
        fetch(`/api/tickets/${id}`).then(r => r.json()),
        fetch(`/api/tickets/${id}/comments`).then(r => r.json()).catch(() => []),
      ])
      setTicket(t)
      setComments(Array.isArray(c) ? c : [])
    } catch {
      setError("Failed to load ticket.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTicket()
    Promise.all([
      fetch("/api/tickets/categories").then(r => r.json()).catch(() => []),
      fetch("/api/tickets/priorities").then(r => r.json()).catch(() => []),
      fetch("/api/tickets/statuses").then(r => r.json()).catch(() => []),
      fetch("/api/users").then(r => r.json()).catch(() => []),
    ]).then(([c, p, s, u]) => {
      setCategories(Array.isArray(c) ? c : [])
      setPriorities(Array.isArray(p) ? p : [])
      setStatuses(Array.isArray(s) ? s : [])
      setUsers(Array.isArray(u) ? u : [])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const patch = async (field: Record<string, string | null>) => {
    setUpdating(true); setError(""); setNotice("")
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(field),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to update.")
      setTicket(data)
      setNotice("Ticket updated.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update.")
    } finally {
      setUpdating(false)
    }
  }

  const handleReply = async () => {
    if (!message.trim()) return
    setPosting(true); setError(""); setNotice("")
    try {
      const res = await fetch(`/api/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), isInternal }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to post comment.")
      setComments(prev => [...prev, data])
      setMessage("")
      setIsInternal(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post comment.")
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-6 w-6 animate-spin text-[var(--brand)]" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="py-24 text-center">
        <p className="text-[var(--text-muted)]">Ticket not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-[var(--brand)] hover:underline">Go back</button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition mt-1 shrink-0">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Ticket className="h-5 w-5 text-[var(--brand)] shrink-0" />
            {ticket.ticketNumber && (
              <span className="text-xs font-mono font-semibold text-[var(--text-muted)] bg-[var(--surface-muted)] px-2 py-0.5 rounded">
                #{ticket.ticketNumber}
              </span>
            )}
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="text-xl font-bold text-[var(--text)] mt-2 leading-snug">{ticket.subject}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Submitted by <span className="font-medium text-[var(--text)]">{ticket.sender?.name ?? "Unknown"}</span>
            {" · "}
            {new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            {" "}
            {new Date(ticket.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        {/* Main — description + comments */}
        <div className="space-y-4">
          {/* Description */}
          {ticket.description && (
            <div className="ui-card p-5">
              <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Description</h2>
              <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </div>
          )}

          {/* Comment thread */}
          <div className="ui-card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-muted)]">
              <p className="text-sm font-semibold text-[var(--text)]">
                Comments <span className="text-[var(--text-muted)] font-normal ml-1">({comments.length})</span>
              </p>
            </div>
            {comments.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--text-muted)]">No comments yet. Be the first to reply.</div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {comments.map(c => (
                  <div key={c.id} className={`px-5 py-4 ${c.isInternal ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                    <div className="flex items-start gap-3">
                      <Avatar name={c.user.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-[var(--text)]">{c.user.name}</span>
                          {c.isInternal && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                              <Lock className="h-2.5 w-2.5" /> Internal Note
                            </span>
                          )}
                          <span className="text-xs text-[var(--text-muted)] ml-auto">
                            {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            {" "}
                            {new Date(c.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed">{c.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply form */}
            {canUpdate ? (
              <div className="px-5 py-4 border-t border-[var(--border)] bg-[var(--surface-muted)] space-y-3">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="ui-textarea min-h-[100px]"
                  placeholder="Write a reply..."
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={e => setIsInternal(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--border)] accent-amber-500"
                    />
                    <span className="text-sm text-[var(--text-muted)] flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5" /> Internal note (admin only)
                    </span>
                  </label>
                  <button
                    onClick={handleReply}
                    disabled={posting || !message.trim()}
                    className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
                  >
                    <Send className="h-4 w-4" />
                    {posting ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Sidebar — ticket controls */}
        <div className="space-y-4">
          <div className="ui-card p-5 space-y-4">
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">Ticket Details</h2>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Status
              </label>
              <select
                className="ui-select text-sm"
                value={ticket.status?.id ?? ""}
                onChange={e => void patch({ statusId: e.target.value })}
                disabled={updating || !canUpdate}
              >
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Priority
              </label>
              <select
                className="ui-select text-sm"
                value={ticket.priority?.id ?? ""}
                onChange={e => void patch({ priorityId: e.target.value })}
                disabled={updating || !canUpdate}
              >
                {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Category
              </label>
              <select
                className="ui-select text-sm"
                value={ticket.category?.id ?? ""}
                onChange={e => void patch({ categoryId: e.target.value })}
                disabled={updating || !canUpdate}
              >
                <option value="">— None —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
                <User className="h-3 w-3" /> Assigned To
              </label>
              <select
                className="ui-select text-sm"
                value={ticket.assignedTo?.id ?? ""}
                onChange={e => void patch({ assignedToId: e.target.value || null })}
                disabled={updating || !canUpdate}
              >
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {!ticket.assignedTo && (
                <p className="text-xs text-red-500 mt-1 font-medium">Not assigned</p>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="ui-card p-5 space-y-3">
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">Info</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-muted)]">Ticket #</span>
                <span className="font-mono font-semibold text-[var(--text)]">{ticket.ticketNumber ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-muted)]">Sender</span>
                <span className="font-medium text-[var(--text)] text-right">{ticket.sender?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-muted)]">Created</span>
                <span className="text-[var(--text)] text-right">
                  {new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-muted)]">Updated</span>
                <span className="text-[var(--text)] text-right">
                  {new Date(ticket.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}