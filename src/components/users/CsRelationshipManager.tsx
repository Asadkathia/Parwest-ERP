"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
import { useSession } from "next-auth/react"
import DataTable from "@/components/shared/DataTable"
type Role = { id: string; name: string }
type User = { id: string; name: string; roleId?: string | null; role?: { id: string; name: string } | null }
type Client = { id: string; name: string }
type Branch = { id: string; name: string; clientId: string }
type RelationshipRow = {
  id: string
  client?: { id: string; name: string } | null
  branch?: { id: string; name: string } | null
  supervisor?: { id: string; name: string } | null
  effectiveDate: string
  status: string
}

export default function CsRelationshipManager() {
  const { data: sessionData } = useSession()
  const sessionUser = sessionData?.user as
    | { regionId?: string | null; roleScopeType?: "GLOBAL" | "REGIONAL" }
    | undefined
  const sessionRegionId = sessionUser?.roleScopeType === "REGIONAL" ? sessionUser?.regionId ?? null : null

  const [rows, setRows] = useState<RelationshipRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [clientId, setClientId] = useState("")
  const [branchId, setBranchId] = useState("")
  const [supervisorId, setSupervisorId] = useState("")
  const [effectiveDate, setEffectiveDate] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const supervisors = useMemo(() => {
    const supervisorRoleIds = new Set(roles.filter((role) => /supervisor/i.test(role.name)).map((role) => role.id))
    return users.filter((user) => (user.roleId && supervisorRoleIds.has(user.roleId)) || /supervisor/i.test(user.role?.name || ""))
  }, [roles, users])

  const visibleBranches = useMemo(() => {
    if (!clientId) return branches
    return branches.filter((branch) => branch.clientId === clientId)
  }, [branches, clientId])

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const regionParam = sessionRegionId ? `?regionId=${encodeURIComponent(sessionRegionId)}` : ""
      const [rolesRes, usersRes, clientsRes, branchesRes, relRes] = await Promise.all([
        fetch("/api/roles", { cache: "no-store" }),
        fetch(`/api/users${regionParam}`, { cache: "no-store" }),
        fetch(`/api/clients${regionParam}`, { cache: "no-store" }),
        fetch(`/api/branches${regionParam}`, { cache: "no-store" }),
        fetch("/api/users/cs-relationships", { cache: "no-store" }),
      ])
      const [rolesJson, usersJson, clientsJson, branchesJson, relJson] = await Promise.all([
        rolesRes.json().catch(() => []),
        usersRes.json().catch(() => []),
        clientsRes.json().catch(() => []),
        branchesRes.json().catch(() => []),
        relRes.json().catch(() => []),
      ])
      if (!rolesRes.ok || !usersRes.ok || !clientsRes.ok || !branchesRes.ok || !relRes.ok) {
        throw new Error(relJson?.message || "Failed to load C/S data.")
      }
      setRoles(Array.isArray(rolesJson) ? rolesJson : [])
      setUsers(Array.isArray(usersJson) ? usersJson : [])
      setClients(Array.isArray(clientsJson) ? clientsJson : [])
      setBranches(Array.isArray(branchesJson) ? branchesJson : [])
      setRows(Array.isArray(relJson) ? relJson : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load C/S data.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRegionId])

  const assign = async () => {
    setNotice("")
    setError("")
    if (!clientId || !supervisorId) {
      setError("Client and supervisor are required.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/users/cs-relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          branchId: branchId || null,
          supervisorId,
          effectiveDate: effectiveDate || null,
          notes: notes || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to create relationship.")
      setNotice("Relationship assigned.")
      setNotes("")
      setEffectiveDate("")
      await load()
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Failed to assign relationship.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setNotice("")
    setError("")
    try {
      const response = await fetch(`/api/users/cs-relationships/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to delete relationship.")
      setNotice("Relationship removed.")
      await load()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove relationship.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"C/S Relationship"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Assign client branches to supervisors."}</p></div></div>
      {notice ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert> : null}
      {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}

      <Card>
        <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select label="Client" value={clientId} onChange={(value) => { setClientId(value); setBranchId("") }} options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="-- Select Client --" />
          <Select label="Branch" value={branchId} onChange={setBranchId} options={visibleBranches.map((b) => ({ value: b.id, label: b.name }))} placeholder="-- Select Branch --" />
          <Select label="Supervisor" value={supervisorId} onChange={setSupervisorId} options={supervisors.map((s) => ({ value: s.id, label: s.name }))} placeholder="-- Select Supervisor --" />
          <Input label="Effective Date" type="date" value={effectiveDate} onChange={setEffectiveDate} />
          <div className="md:col-span-2">
            <Input label="Notes" value={notes} onChange={setNotes} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={assign} disabled={saving}>{saving ? "Assigning..." : "Assign"}</Button>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</Button>
        </div>
      </CardContent>
      </Card>

      <DataTable
        rows={rows}
        columns={[
          { key: "client", header: "Client", render: (row) => row.client?.name || "—" },
          { key: "branch", header: "Branch", render: (row) => row.branch?.name || "—" },
          { key: "supervisor", header: "Supervisor", render: (row) => row.supervisor?.name || "—" },
          { key: "effectiveDate", header: "Effective Date", render: (row) => new Date(row.effectiveDate).toLocaleDateString("en-US") },
          { key: "status", header: "Status" },
          { key: "action", header: "Action", render: (row) => <button className="text-red-600 hover:underline" onClick={() => void remove(row.id)}>Delete</button> },
        ]}
        rowKey="id"
        emptyText={loading ? "Loading relationships..." : "No relationship records."}
        searchable={false}
      />
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input className="ui-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
