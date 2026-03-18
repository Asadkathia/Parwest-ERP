"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Role = { id: string; name: string }
type Region = { id: string; name: string }
type RegionalOffice = { id: string; name: string; regionId?: string | null }

type UserRow = {
  id: string
  name: string
  email: string
  status: string
  role?: Role | null
  region?: Region | null
  regionalOffice?: RegionalOffice | null
}

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  roleId: "",
  status: "ACTIVE",
  regionId: "",
  regionalOfficeId: "",
  contactNumber: "",
}

export default function UsersManager() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [offices, setOffices] = useState<RegionalOffice[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [usersData, rolesData, regionsData, officesData] = await Promise.all([
        apiGet<UserRow[]>("/api/users"),
        apiGet<Role[]>("/api/roles"),
        apiGet<Region[]>("/api/regions"),
        apiGet<RegionalOffice[]>("/api/regional-offices"),
      ])
      setRows(usersData)
      setRoles(rolesData)
      setRegions(regionsData)
      setOffices(officesData)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load users."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRows = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      return `${row.name} ${row.email} ${row.role?.name || ""} ${row.regionalOffice?.name || ""} ${row.status}`.toLowerCase().includes(q)
    })
  }, [rows, query])

  const visibleOffices = useMemo(() => {
    if (!form.regionId) return offices
    return offices.filter((office) => !office.regionId || office.regionId === form.regionId)
  }, [offices, form.regionId])

  const reset = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const startEdit = (row: UserRow) => {
    setEditingId(row.id)
    setForm({
      name: row.name,
      email: row.email,
      password: "",
      roleId: row.role?.id || "",
      status: row.status || "ACTIVE",
      regionId: row.region?.id || "",
      regionalOfficeId: row.regionalOffice?.id || "",
      contactNumber: "",
    })
  }

  const submit = async () => {
    if (!form.name.trim() || !form.roleId) {
      setNotice({ type: "error", message: "Name and role are required." })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      if (editingId) {
        await apiSend<UserRow>(`/api/users/${editingId}`, "PATCH", {
          name: form.name.trim(),
          roleId: form.roleId,
          status: form.status,
          regionId: form.regionId || null,
          regionalOfficeId: form.regionalOfficeId || null,
          contactNumber: form.contactNumber.trim() || null,
        })
        setNotice({ type: "success", message: "User updated successfully." })
      } else {
        if (!form.email.trim() || !form.password.trim()) {
          setNotice({ type: "error", message: "Email and password are required for new users." })
          return
        }
        await apiSend<UserRow>("/api/users", "POST", {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          roleId: form.roleId,
          status: form.status,
          regionId: form.regionId || null,
          regionalOfficeId: form.regionalOfficeId || null,
          contactNumber: form.contactNumber.trim() || null,
        })
        setNotice({ type: "success", message: "User created successfully." })
      }

      reset()
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save user."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Users" subtitle="Manage inventory users with role and office assignment." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Name *</label>
            <input className="ui-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Role *</label>
            <select className="ui-select" value={form.roleId} onChange={(e) => setForm((prev) => ({ ...prev, roleId: e.target.value }))}>
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Status</label>
            <select className="ui-select" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Contact Number</label>
            <input className="ui-input" value={form.contactNumber} onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Email {!editingId ? "*" : ""}</label>
            <input
              className="ui-input"
              value={form.email}
              disabled={Boolean(editingId)}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Password {!editingId ? "*" : ""}</label>
            <input
              className="ui-input"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder={editingId ? "Leave empty to keep existing password" : ""}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Region</label>
            <select
              className="ui-select"
              value={form.regionId}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  regionId: e.target.value,
                  regionalOfficeId: "",
                }))
              }
            >
              <option value="">Select region</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Regional Office</label>
            <select className="ui-select" value={form.regionalOfficeId} onChange={(e) => setForm((prev) => ({ ...prev, regionalOfficeId: e.target.value }))}>
              <option value="">Select office</option>
              {visibleOffices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <ActionButton onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update User" : "Create User"}
          </ActionButton>
          <ActionButton variant="secondary" onClick={reset}>
            Reset
          </ActionButton>
        </div>
      </FilterBar>

      <FilterBar>
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
          <input
            className="ui-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name/email/role/status"
          />
        </div>
      </FilterBar>

      <DataTable
        rows={visibleRows}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading users..." : "No users found."}
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "email", header: "Email", sortable: true },
          { key: "role", header: "Role", render: (row) => row.role?.name || "—" },
          { key: "regionalOffice", header: "Stores/Warehouse", render: (row) => row.regionalOffice?.name || "—" },
          { key: "status", header: "Status", sortable: true },
          {
            key: "actions",
            header: "Action",
            render: (row) => (
              <button className="text-[var(--brand)] hover:underline" onClick={() => startEdit(row)}>
                Edit
              </button>
            ),
          },
        ]}
      />
    </div>
  )
}
