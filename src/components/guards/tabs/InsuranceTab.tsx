"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, X, Loader2, RefreshCw } from "lucide-react"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type ClientInsuranceOption = {
  id: string
  insuranceName: string
  status: string
  client: { id: string; name: string }
}

type GuardInsuranceRecord = {
  id: string
  healthId: string | null
  status: string
  createdAt: string
  clientInsurance: {
    id: string
    insuranceName: string
    client: { id: string; name: string }
  }
  createdBy: { id: string; name: string } | null
}

interface InsuranceTabProps {
  insurance: GuardLooseRow[]
  guardId: string
  parwestId?: string
  canCreate?: boolean
  canUpdate?: boolean
}

export default function InsuranceTab({ guardId, parwestId, canCreate = false, canUpdate = false }: InsuranceTabProps) {
  const [records, setRecords] = useState<GuardInsuranceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<GuardInsuranceRecord | null>(null)

  // For add modal
  const [clientInsurances, setClientInsurances] = useState<ClientInsuranceOption[]>([])
  const [selectedInsuranceId, setSelectedInsuranceId] = useState("")
  const [healthId, setHealthId] = useState("")
  const [addError, setAddError] = useState("")
  const [addSaving, setAddSaving] = useState(false)
  const [insLoading, setInsLoading] = useState(false)

  // For status modal
  const [newStatus, setNewStatus] = useState("")
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState("")

  const fetchRecords = useCallback(() => {
    if (!guardId) return
    setLoading(true)
    fetch(`/api/guards/${guardId}/insurance`)
      .then(r => r.json())
      .then(data => { setRecords(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setRecords([]); setLoading(false) })
  }, [guardId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch driven by guardId via callback
  useEffect(() => { fetchRecords() }, [fetchRecords])

  function openAddModal() {
    setAddError(""); setHealthId(""); setSelectedInsuranceId("")
    setShowAddModal(true)
    // Fetch client insurances (ACTIVE only)
    setInsLoading(true)
    fetch("/api/client-insurances?status=ACTIVE")
      .then(r => r.json())
      .then(data => { setClientInsurances(Array.isArray(data) ? data : []); setInsLoading(false) })
      .catch(() => { setClientInsurances([]); setInsLoading(false) })
  }

  async function handleAdd() {
    setAddError("")
    if (!selectedInsuranceId) { setAddError("Please select a client insurance."); return }
    setAddSaving(true)
    try {
      const res = await fetch(`/api/guards/${guardId}/insurance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientInsuranceId: selectedInsuranceId, healthId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setAddError((d as { error?: string })?.error || "Failed to assign insurance.")
      } else {
        setShowAddModal(false)
        fetchRecords()
      }
    } catch { setAddError("Network error.") }
    setAddSaving(false)
  }

  function openStatusModal(record: GuardInsuranceRecord) {
    setSelectedRecord(record)
    setNewStatus(record.status)
    setStatusError("")
    setShowStatusModal(true)
  }

  async function handleChangeStatus() {
    if (!selectedRecord) return
    setStatusError("")
    setStatusSaving(true)
    try {
      const res = await fetch(`/api/guards/${guardId}/insurance/${selectedRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setStatusError((d as { error?: string })?.error || "Failed to update status.")
      } else {
        setShowStatusModal(false)
        fetchRecords()
      }
    } catch { setStatusError("Network error.") }
    setStatusSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text)]">Guard Insurance</h2>
        <div className="flex items-center gap-2">
          {canUpdate && records.length > 0 && (
            <button
              onClick={() => records.length > 0 && openStatusModal(records[0])}
              className="ui-btn ui-btn-secondary text-sm flex items-center gap-1.5 px-3 py-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Change Status
            </button>
          )}
          {canCreate && (
            <button
              onClick={openAddModal}
              className="ui-btn ui-btn-primary text-sm flex items-center gap-1.5 px-3 py-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1a2942] text-white text-xs uppercase">
                <th className="px-4 py-3 text-left">Parwest ID</th>
                <th className="px-4 py-3 text-left">Health ID</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Insurance</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[var(--text-muted)]">
                    No insurance records found
                  </td>
                </tr>
              ) : records.map(rec => (
                <tr key={rec.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]/40">
                  <td className="px-4 py-3 font-mono text-sm">{parwestId || "—"}</td>
                  <td className="px-4 py-3">{rec.healthId || "—"}</td>
                  <td className="px-4 py-3">{rec.clientInsurance.client.name}</td>
                  <td className="px-4 py-3">{rec.clientInsurance.insuranceName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rec.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {rec.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canUpdate ? (
                      <button
                        onClick={() => openStatusModal(rec)}
                        className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                      >
                        Change Status
                      </button>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Health ID Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-base font-semibold text-[var(--text)]">ADD HEALTH ID</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Health ID */}
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Health ID</label>
                <input
                  className="ui-input"
                  placeholder="Enter Health ID"
                  value={healthId}
                  onChange={e => setHealthId(e.target.value)}
                />
              </div>
              {/* Client Insurance */}
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Client</label>
                {insLoading ? (
                  <div className="ui-input flex items-center gap-2 text-[var(--text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : (
                  <select
                    className="ui-input"
                    value={selectedInsuranceId}
                    onChange={e => setSelectedInsuranceId(e.target.value)}
                  >
                    <option value="">Select Client</option>
                    {clientInsurances.map(ci => (
                      <option key={ci.id} value={ci.id}>
                        {ci.client.name} — {ci.insuranceName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {addError && <p className="text-red-500 text-sm">{addError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowAddModal(false)} className="ui-btn ui-btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={addSaving} className="ui-btn ui-btn-primary px-4 py-2 text-sm flex items-center gap-2">
                {addSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {showStatusModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-base font-semibold text-[var(--text)]">Change Insurance Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text)]">{selectedRecord.clientInsurance.insuranceName}</span> — {selectedRecord.clientInsurance.client.name}
              </p>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">New Status</label>
                <select className="ui-input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              {statusError && <p className="text-red-500 text-sm">{statusError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowStatusModal(false)} className="ui-btn ui-btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={handleChangeStatus} disabled={statusSaving} className="ui-btn ui-btn-primary px-4 py-2 text-sm flex items-center gap-2">
                {statusSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
