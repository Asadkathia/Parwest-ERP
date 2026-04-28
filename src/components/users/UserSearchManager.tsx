"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { Badge } from "@/components/shadcn/badge"
import { Card, CardContent } from "@/components/shadcn/card"
import { useSession } from "next-auth/react"
import DataTable from "@/components/shared/DataTable"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { AlertCircle } from "lucide-react"

type RoleOption = { id: string; name: string }
type UserRow = {
  id: string
  name: string
  email: string
  status: string
  createdAt: string
  role?: { id: string; name: string; scopeType?: "GLOBAL" | "REGIONAL" } | null
  regionalOffice?: { id: string; name: string } | null
}

function formatRegionalOffice(row: UserRow): string {
  if (row.role?.scopeType === "GLOBAL") return "Global"
  return row.regionalOffice?.name || "—"
}

export default function UserSearchManager() {
  const { data: sessionData } = useSession()
  const sessionUser = sessionData?.user as
    | { regionId?: string | null; roleScopeType?: "GLOBAL" | "REGIONAL" }
    | undefined
  const sessionRegionId = sessionUser?.roleScopeType === "REGIONAL" ? sessionUser?.regionId ?? null : null

  const [rows, setRows] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [search, setSearch] = useState("")
  const [roleId, setRoleId] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set("search", search.trim())
      if (roleId) params.set("roleId", roleId)
      if (status) params.set("status", status)
      if (sessionRegionId) params.set("regionId", sessionRegionId)

      const response = await fetch(`/api/users?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to fetch users.")
      }
      setRows(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to fetch users.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [roleId, search, status, sessionRegionId])

  useEffect(() => {
    let cancelled = false
    async function loadDependencies() {
      try {
        const response = await fetch("/api/roles", { cache: "no-store" })
        const payload = await response.json().catch(() => [])
        if (!response.ok) return
        if (!cancelled) {
          setRoles(Array.isArray(payload) ? payload : [])
        }
      } catch {
        // no-op: search works without role options
      }
    }
    void loadDependencies()
    void load()
    return () => {
      cancelled = true
    }
  }, [load])

  const rowsForExport = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role?.name || "—",
        office: formatRegionalOffice(row),
        status: row.status,
      })),
    [rows]
  )

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Search Users"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Search and filter users from backend data."}</p></div></div>
      {error ? (
        <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Search" value={search} onChange={setSearch} placeholder="Name or email" />
          <SelectField
            label="User Role"
            value={roleId}
            onChange={setRoleId}
            options={roles.map((role) => ({ value: role.id, label: role.name }))}
            placeholder="-- Select User Role --"
          />
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            placeholder="-- Select Status --"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={load} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
          <Button 
            variant="secondary" onClick={() => {
              setSearch("")
              setRoleId("")
              setStatus("")
              void load()
            }}>
            Clear
          </Button>
          <Button 
            variant="secondary" onClick={() => {
              const blob = new Blob([JSON.stringify(rowsForExport, null, 2)], { type: "application/json" })
              const url = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.href = url
              link.download = `users-export-${Date.now()}.json`
              link.click()
              URL.revokeObjectURL(url)
            }}>
            Export
          </Button>
        </div>
      </CardContent>
      </Card>

      <DataTable
        rows={rows}
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "email", header: "Email", sortable: true },
          { key: "role", header: "Role", render: (row) => row.role?.name || "—", sortable: true },
          { key: "regionalOffice", header: "Regional Office", render: (row) => formatRegionalOffice(row), sortable: true },
          {
            key: "status",
            header: "Status",
            sortable: true,
            render: (row) => (
              <Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{row.status}</Badge>
            ),
          },
          {
            key: "createdAt",
            header: "Created",
            sortable: true,
            render: (row) => new Date(row.createdAt).toLocaleDateString("en-US"),
          },
        ]}
        rowKey="id"
        emptyText={loading ? "Loading users..." : "No users found."}
        searchable={false}
      />
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input className="ui-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function SelectField({
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
