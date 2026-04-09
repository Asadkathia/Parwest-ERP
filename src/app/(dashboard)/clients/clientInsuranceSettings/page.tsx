"use client"

import { useEffect, useState, useCallback } from "react"
import { Shield, Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react"

type RegionalOffice = { id: string; name: string }
type Client = { id: string; name: string }

type ClientInsurance = {
  id: string
  insuranceName: string
  status: string
  startDate: string | null
  endDate: string | null
  createdAt: string
  client: {
    id: string
    name: string
    regionalOffice: { id: string; name: string } | null
    region: { id: string; name: string } | null
  }
  createdBy: { id: string; name: string; email: string } | null
}

function formatDate(val: string | null | undefined) {
  if (!val) return "—"
  const d = new Date(val)
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })
}

export default function ClientInsuranceSettingsPage() {
  const [allRegionalOffices, setAllRegionalOffices] = useState<RegionalOffice[]>([])
  const [insurances, setInsurances] = useState<ClientInsurance[]>([])

  // Form state
  const [formRoId, setFormRoId] = useState("")
  const [formClients, setFormClients] = useState<Client[]>([])
  const [formClientId, setFormClientId] = useState("")
  const [formInsuranceName, setFormInsuranceName] = useState("")
  const [formStatus, setFormStatus] = useState("ACTIVE")
  const [formStartDate, setFormStartDate] = useState("")
  const [formEndDate, setFormEndDate] = useState("")
  const [formClientsLoading, setFormClientsLoading] = useState(false)

  // Filter state
  const [filterRoId, setFilterRoId] = useState("")
  const [filterClients, setFilterClients] = useState<Client[]>([])
  const [filterClientId, setFilterClientId] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [search, setSearch] = useState("")

  // UI state
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editStatus, setEditStatus] = useState("")
  const [editStart, setEditStart] = useState("")
  const [editEnd, setEditEnd] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load all regional offices on mount
  useEffect(() => {
    fetch("/api/regional-offices")
      .then(r => r.json())
      .then(data => setAllRegionalOffices(Array.isArray(data) ? data : []))
      .catch(() => setAllRegionalOffices([]))
  }, [])

  // Load clients when form regional office changes
  useEffect(() => {
    setFormClientId("")
    setFormClients([])
    if (!formRoId) return
    setFormClientsLoading(true)
    fetch(`/api/clients?regionalOfficeId=${formRoId}&limit=500`)
      .then(r => r.json())
      .then(data => { setFormClients(Array.isArray(data) ? data : (data?.clients ?? [])); setFormClientsLoading(false) })
      .catch(() => { setFormClients([]); setFormClientsLoading(false) })
  }, [formRoId])

  // Load clients when filter regional office changes
  useEffect(() => {
    setFilterClientId("")
    setFilterClients([])
    if (!filterRoId) return
    fetch(`/api/clients?regionalOfficeId=${filterRoId}&limit=500`)
      .then(r => r.json())
      .then(data => setFilterClients(Array.isArray(data) ? data : (data?.clients ?? [])))
      .catch(() => setFilterClients([]))
  }, [filterRoId])

  const fetchInsurances = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterRoId) params.set("regionalOfficeId", filterRoId)
    if (filterClientId) params.set("clientId", filterClientId)
    if (filterStatus) params.set("status", filterStatus)
    fetch(`/api/client-insurances?${params.toString()}`)
      .then(r => r.json())
      .then(data => { setInsurances(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setInsurances([]); setLoading(false) })
  }, [filterRoId, filterClientId, filterStatus])

  useEffect(() => { fetchInsurances() }, [fetchInsurances])

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError(""); setSuccess("")
    if (!formClientId) { setError("Please select a client."); return }
    if (!formInsuranceName.trim()) { setError("Insurance name is required."); return }
    setSaving(true)
    try {
      const res = await fetch("/api/client-insurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: formClientId,
          insuranceName: formInsuranceName.trim(),
          status: formStatus,
          startDate: formStartDate || null,
          endDate: formEndDate || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string })?.error || "Failed to save.")
      } else {
        setSuccess("Insurance added successfully.")
        setFormInsuranceName(""); setFormStartDate(""); setFormEndDate("")
        setFormStatus("ACTIVE"); setFormClientId(""); setFormRoId("")
        fetchInsurances()
      }
    } catch { setError("Network error.") }
    setSaving(false)
  }

  async function handleSaveEdit(id: string) {
    setError(""); setSuccess("")
    if (!editName.trim()) { setError("Insurance name is required."); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/client-insurances/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insuranceName: editName.trim(), status: editStatus, startDate: editStart || null, endDate: editEnd || null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string })?.error || "Failed to update.")
      } else {
        setSuccess("Updated successfully.")
        setEditingId(null)
        fetchInsurances()
      }
    } catch { setError("Network error.") }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this insurance record?")) return
    setError(""); setSuccess("")
    setDeletingId(id)
    try {
      const res = await fetch(`/api/client-insurances/${id}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string })?.error || "Failed to delete.") }
      else { setSuccess("Deleted successfully."); fetchInsurances() }
    } catch { setError("Network error.") }
    setDeletingId(null)
  }

  const filtered = insurances.filter(ins => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      ins.insuranceName.toLowerCase().includes(q) ||
      ins.client.name.toLowerCase().includes(q) ||
      (ins.client.regionalOffice?.name || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-[var(--brand)]" />
        <h1 className="text-2xl font-bold text-[var(--text)]">Insurance by Clients</h1>
      </div>

      {/* Add Form */}
      <div className="ui-card p-6">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4 uppercase tracking-widest">CLIENTS INSURANCE</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Regional Office */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wide">Regional Office</label>
              <select className="ui-input" value={formRoId} onChange={e => setFormRoId(e.target.value)}>
                <option value="">All Regional Offices</option>
                {allRegionalOffices.map(ro => <option key={ro.id} value={ro.id}>{ro.name}</option>)}
              </select>
            </div>
            {/* Client */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wide">Clients</label>
              {!formRoId ? (
                <select className="ui-input opacity-60" disabled>
                  <option>Select Regional Office First</option>
                </select>
              ) : formClientsLoading ? (
                <div className="ui-input flex items-center gap-2 text-[var(--text-muted)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                </div>
              ) : (
                <select className="ui-input" value={formClientId} onChange={e => setFormClientId(e.target.value)} required>
                  <option value="">Select Client</option>
                  {formClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            {/* Insurance Name */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wide">Insurance Name</label>
              <input className="ui-input" placeholder="Enter Insurance Name" value={formInsuranceName} onChange={e => setFormInsuranceName(e.target.value)} />
            </div>
            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wide">Status</label>
              <select className="ui-input" value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wide">Start Date</label>
              <input type="date" className="ui-input" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
            </div>
            {/* End Date */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wide">End Date</label>
              <input type="date" className="ui-input" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="ui-btn ui-btn-primary flex items-center gap-2 px-5" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Submit
            </button>
            {error && <span className="text-red-500 text-sm">{error}</span>}
            {success && <span className="text-green-600 text-sm">{success}</span>}
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="ui-card p-6">
        {/* Table header with filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-[var(--text)]">Client Insurances</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select className="ui-input text-sm py-1.5 px-2 min-w-[140px]" value={filterRoId} onChange={e => setFilterRoId(e.target.value)}>
              <option value="">All Regional Offices</option>
              {allRegionalOffices.map(ro => <option key={ro.id} value={ro.id}>{ro.name}</option>)}
            </select>
            {filterRoId && (
              <select className="ui-input text-sm py-1.5 px-2 min-w-[140px]" value={filterClientId} onChange={e => setFilterClientId(e.target.value)}>
                <option value="">All Clients</option>
                {filterClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <select className="ui-input text-sm py-1.5 px-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[var(--text-muted)]">SEARCH:</span>
              <input className="ui-input text-sm py-1.5 px-2 w-36" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1a2942] text-white text-xs uppercase">
                  <th className="px-3 py-3 text-left">#</th>
                  <th className="px-3 py-3 text-left">Regional Office <span className="inline-block ml-1">⇅</span></th>
                  <th className="px-3 py-3 text-left">Client <span className="inline-block ml-1">⇅</span></th>
                  <th className="px-3 py-3 text-left">Insurance Name <span className="inline-block ml-1">⇅</span></th>
                  <th className="px-3 py-3 text-left">Status <span className="inline-block ml-1">⇅</span></th>
                  <th className="px-3 py-3 text-left">Start Date <span className="inline-block ml-1">⇅</span></th>
                  <th className="px-3 py-3 text-left">End Date <span className="inline-block ml-1">⇅</span></th>
                  <th className="px-3 py-3 text-left">Created By <span className="inline-block ml-1">⇅</span></th>
                  <th className="px-3 py-3 text-left">Created At <span className="inline-block ml-1">⇅</span></th>
                  <th className="px-3 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-[var(--text-muted)]">
                      No data available in table
                    </td>
                  </tr>
                ) : filtered.map((ins, idx) => (
                  <tr key={ins.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]/40 transition-colors">
                    <td className="px-3 py-3 text-[var(--text-muted)]">{idx + 1}</td>
                    <td className="px-3 py-3">{ins.client.regionalOffice?.name || "—"}</td>
                    <td className="px-3 py-3 font-medium">{ins.client.name}</td>
                    <td className="px-3 py-3">
                      {editingId === ins.id
                        ? <input className="ui-input py-1 text-sm w-36" value={editName} onChange={e => setEditName(e.target.value)} />
                        : ins.insuranceName}
                    </td>
                    <td className="px-3 py-3">
                      {editingId === ins.id ? (
                        <select className="ui-input py-1 text-sm" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ins.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                          {ins.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingId === ins.id
                        ? <input type="date" className="ui-input py-1 text-sm" value={editStart} onChange={e => setEditStart(e.target.value)} />
                        : formatDate(ins.startDate)}
                    </td>
                    <td className="px-3 py-3">
                      {editingId === ins.id
                        ? <input type="date" className="ui-input py-1 text-sm" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
                        : formatDate(ins.endDate)}
                    </td>
                    <td className="px-3 py-3 text-[var(--text-muted)]">{ins.createdBy?.name || "—"}</td>
                    <td className="px-3 py-3 text-[var(--text-muted)]">{formatDate(ins.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {editingId === ins.id ? (
                          <>
                            <button onClick={() => handleSaveEdit(ins.id)} disabled={saving} title="Save" className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200">
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => setEditingId(null)} title="Cancel" className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              title="Edit"
                              onClick={() => {
                                setEditingId(ins.id)
                                setEditName(ins.insuranceName)
                                setEditStatus(ins.status)
                                setEditStart(ins.startDate ? ins.startDate.slice(0, 10) : "")
                                setEditEnd(ins.endDate ? ins.endDate.slice(0, 10) : "")
                                setError(""); setSuccess("")
                              }}
                              className="p-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              title="Delete"
                              onClick={() => handleDelete(ins.id)}
                              disabled={deletingId === ins.id}
                              className="p-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              {deletingId === ins.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-xs text-[var(--text-muted)]">
              Showing {filtered.length === 0 ? 0 : 1} to {filtered.length} of {filtered.length} entries
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
