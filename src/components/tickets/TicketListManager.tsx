"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Search, RefreshCw, Tag, AlertCircle, CheckCircle2, Clock } from "lucide-react"
import InlineAlert from "@/components/ui/inline-alert"

type Lookup = { id: string; name: string; color?: string | null }
type TicketRow = {
  id: string
  ticketNumber?: number | null
  subject: string
  sender?: { id: string; name: string } | null
  assignedTo?: { id: string; name: string } | null
  category?: Lookup | null
  priority?: Lookup | null
  status?: Lookup | null
  createdAt: string
}

const PAGE_SIZES = [10, 25, 50, 100]

function ColorDot({ color }: { color?: string | null }) {
  if (!color) return null
  return <span className="inline-block h-2 w-2 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: color }} />
}

function PriorityBadge({ priority }: { priority?: Lookup | null }) {
  if (!priority) return <span className="text-[var(--text-muted)]">—</span>
  const c = priority.color || "#94a3b8"
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border" style={{ color: c, borderColor: c, backgroundColor: `${c}20` }}>
      {priority.name}
    </span>
  )
}

function StatusBadge({ status }: { status?: Lookup | null }) {
  if (!status) return <span className="text-[var(--text-muted)]">—</span>
  const n = status.name.toLowerCase()
  const c = status.color || (n.includes("close") || n.includes("resolv") ? "#10b981" : n.includes("progress") ? "#f59e0b" : "#6366f1")
  const Icon = n.includes("close") || n.includes("resolv") ? CheckCircle2 : n.includes("progress") ? Clock : AlertCircle
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ color: c, borderColor: c, backgroundColor: `${c}20` }}>
      <Icon className="h-3 w-3" />{status.name}
    </span>
  )
}

export default function TicketListManager() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [categories, setCategories] = useState<Lookup[]>([])
  const [priorities, setPriorities] = useState<Lookup[]>([])
  const [statuses, setStatuses] = useState<Lookup[]>([])
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState("")
  const [filterPrio, setFilterPrio] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortKey, setSortKey] = useState("createdAt")
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const p = new URLSearchParams()
      if (search.trim()) p.set("search", search.trim())
      if (filterCat) p.set("categoryId", filterCat)
      if (filterPrio) p.set("priorityId", filterPrio)
      if (filterStatus) p.set("statusId", filterStatus)
      const res = await fetch(`/api/tickets?${p}`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      if (!res.ok) throw new Error(data?.message || "Failed to load.")
      setTickets(Array.isArray(data) ? data : [])
      setPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets.")
    } finally { setLoading(false) }
  }, [search, filterCat, filterPrio, filterStatus])

  useEffect(() => {
    Promise.all([
      fetch("/api/tickets/categories").then(r=>r.json()).catch(()=>[]),
      fetch("/api/tickets/priorities").then(r=>r.json()).catch(()=>[]),
      fetch("/api/tickets/statuses").then(r=>r.json()).catch(()=>[]),
    ]).then(([c,p,s])=>{ setCategories(Array.isArray(c)?c:[]); setPriorities(Array.isArray(p)?p:[]); setStatuses(Array.isArray(s)?s:[]) })
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSort = (k: string) => { if (sortKey===k) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortKey(k); setSortDir("asc") } }

  const sorted = [...tickets].sort((a,b) => {
    if (sortKey==="ticketNumber") {
      const diff = (a.ticketNumber??0) - (b.ticketNumber??0)
      return sortDir==="asc" ? diff : -diff
    }
    const av = String((a as Record<string,unknown>)[sortKey]??"")
    const bv = String((b as Record<string,unknown>)[sortKey]??"")
    return sortDir==="asc" ? av.localeCompare(bv) : bv.localeCompare(av)
  })
  const totalPages = Math.max(1, Math.ceil(sorted.length/pageSize))
  const paged = sorted.slice((page-1)*pageSize, page*pageSize)

  const Th = ({ col, label }: { col: string; label: string }) => (
    <th onClick={()=>toggleSort(col)} className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer select-none hover:bg-white/10 whitespace-nowrap">
      {label}
      <span className="ml-1 text-[10px] opacity-50">{sortKey===col ? (sortDir==="asc"?"▲":"▼") : "⇅"}</span>
    </th>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Tickets</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Track and resolve support tickets</p>
        </div>
        <Link href="/tickets/new" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Ticket
        </Link>
      </div>

      {error ? <InlineAlert type="error" message={error} /> : null}

      {/* Filters */}
      <div className="ui-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input className="ui-input pl-9" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void load()} placeholder="Search subject or description..." />
          </div>
          <select className="ui-select" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="ui-select" value={filterPrio} onChange={e=>setFilterPrio(e.target.value)}>
            <option value="">All Priorities</option>
            {priorities.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="ui-select" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition">
            <RefreshCw className={`h-3.5 w-3.5 ${loading?"animate-spin":""}`} /> {loading?"Loading...":"Search"}
          </button>
          <button onClick={()=>{setSearch("");setFilterCat("");setFilterPrio("");setFilterStatus("");void load()}} className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition">
            Clear
          </button>
          <span className="ml-auto text-xs text-[var(--text-muted)]">{tickets.length} total</span>
        </div>
      </div>

      {/* Table */}
      <div className="ui-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-muted)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">
            SHOW
            <select className="ui-select w-16 py-1 text-xs" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}>
              {PAGE_SIZES.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
            ENTRIES
          </div>
          <Link href="/tickets/prerequisites" className="flex items-center gap-1 text-xs text-[var(--brand)] hover:underline">
            <Tag className="h-3 w-3" /> Configure Lookups
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr style={{background:"#1e2a3a"}}>
                <Th col="ticketNumber" label="ID" />
                <Th col="subject" label="Subject" />
                <Th col="sender" label="Sender" />
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Category</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Priority</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Assigned To</th>
                <Th col="createdAt" label="Created At" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {paged.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-sm text-[var(--text-muted)]">{loading?"Loading...":"No tickets found."}</td></tr>
              ) : paged.map(t => {
                const urgent = ["high","critical","urgent"].some(w=>t.priority?.name?.toLowerCase().includes(w))
                return (
                  <tr key={t.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                    <td className="px-3 py-3 text-sm font-mono text-[var(--text-muted)] whitespace-nowrap">{t.ticketNumber??"-"}</td>
                    <td className="px-3 py-3 max-w-[280px]">
                      <Link href={`/tickets/${t.id}`} className={`text-sm font-medium hover:underline line-clamp-2 ${urgent?"text-red-600":"text-[var(--brand)]"}`}>{t.subject}</Link>
                    </td>
                    <td className="px-3 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">{t.sender?.name??"—"}</td>
                    <td className="px-3 py-3 text-sm whitespace-nowrap">
                      {t.category ? <span className="inline-flex items-center"><ColorDot color={t.category.color}/>{t.category.name}</span> : "—"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap"><PriorityBadge priority={t.priority}/></td>
                    <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={t.status}/></td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm">
                      {t.assignedTo
                        ? <span className="font-semibold text-emerald-600">{t.assignedTo.name}</span>
                        : <span className="font-semibold text-red-500 text-xs">NOT ASSIGNED</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-muted)]">
          <p className="text-xs text-[var(--text-muted)]">
            Showing {tickets.length===0?0:(page-1)*pageSize+1}–{Math.min(page*pageSize,tickets.length)} of {tickets.length} entries
          </p>
          <div className="flex items-center gap-1">
            {["Previous",...Array.from({length:Math.min(totalPages,7)},(_,i)=>String(i+1)),...(totalPages>7?[String(totalPages)]:[]),"Next"].map((lbl,i)=>{
              const isNum = !isNaN(Number(lbl))
              const pg = Number(lbl)
              const disabled = lbl==="Previous"?page===1:lbl==="Next"?page>=totalPages:false
              const active = isNum && pg===page
              return <button key={i} onClick={()=>{
                if(lbl==="Previous") setPage(p=>Math.max(1,p-1))
                else if(lbl==="Next") setPage(p=>Math.min(totalPages,p+1))
                else setPage(pg)
              }} disabled={disabled} className={`min-w-[34px] h-8 px-2 rounded text-xs font-medium border transition ${active?"bg-[var(--brand)] text-white border-[var(--brand)]":disabled?"opacity-40 cursor-not-allowed border-[var(--border)] text-[var(--text-muted)]":"border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-muted)]"}`}>{lbl}</button>
            })}
          </div>
        </div>
      </div>
    </div>
  )
}