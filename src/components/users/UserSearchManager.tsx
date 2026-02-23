"use client"

import { useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"

type UserRow = {
  id: string
  name: string
  email: string
  role: string
  office: string
  status: string
  createdAt: string
}

const mockUsers: UserRow[] = [
  { id: "U-001", name: "Admin User", email: "admin@parwestgroup.com", role: "Admin", office: "head office lahore", status: "Active", createdAt: "2026-01-11" },
  { id: "U-002", name: "Muhammad Nazir", email: "nazir@parwestgroup.com", role: "Manager", office: "head office lahore", status: "Active", createdAt: "2026-01-14" },
  { id: "U-003", name: "Fazal Mehdi", email: "fazal@parwestgroup.com", role: "Supervisor", office: "karachi office", status: "Inactive", createdAt: "2026-01-17" },
]

export default function UserSearchManager() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("")
  const [office, setOffice] = useState("")
  const [status, setStatus] = useState("")
  const [entries, setEntries] = useState("10")
  const [search, setSearch] = useState("")
  const [selectDate, setSelectDate] = useState("")

  const filtered = useMemo(() => {
    return mockUsers
      .filter((row) => {
        if (name && !row.name.toLowerCase().includes(name.toLowerCase())) return false
        if (email && !row.email.toLowerCase().includes(email.toLowerCase())) return false
        if (role && row.role !== role) return false
        if (office && row.office !== office) return false
        if (status && row.status !== status) return false
        if (search && !`${row.id} ${row.name} ${row.email} ${row.role}`.toLowerCase().includes(search.toLowerCase())) return false
        if (selectDate && row.createdAt !== selectDate) return false
        return true
      })
      .slice(0, Number.parseInt(entries, 10) || 10)
  }, [name, email, role, office, status, search, selectDate, entries])

  const clear = () => {
    setName("")
    setEmail("")
    setRole("")
    setOffice("")
    setStatus("")
    setEntries("10")
    setSearch("")
    setSelectDate("")
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Search Users" subtitle="Legacy search user controls and table." />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} />
          <SelectField label="User Role" value={role} onChange={setRole} options={["Admin", "Manager", "Supervisor", "Accountant"]} placeholder="-- Select User Role --" />
          <SelectField label="Regional Office" value={office} onChange={setOffice} options={["head office lahore", "karachi office", "islamabad office"]} placeholder="-- Select Regional Office --" />
          <SelectField label="Status" value={status} onChange={setStatus} options={["Active", "Inactive"]} placeholder="-- Select Status --" />
          <SelectField label="Show 102550100200 entries" value={entries} onChange={setEntries} options={["10", "25", "50", "100", "200"]} placeholder="10" />
          <Field label="Search:" value={search} onChange={setSearch} />
          <Field label="Select Date" type="date" value={selectDate} onChange={setSelectDate} />
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton>Search</ActionButton>
          <ActionButton variant="secondary" onClick={clear}>Clear</ActionButton>
          <ActionButton variant="secondary">Export In Excel</ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={filtered}
        columns={[
          { key: "id", header: "ID" },
          { key: "photo", header: "Photo", render: () => "—" },
          { key: "name", header: "Name", sortable: true },
          { key: "email", header: "Email", sortable: true },
          { key: "role", header: "Role", sortable: true },
          { key: "office", header: "Regional Office", sortable: true },
          { key: "status", header: "Status", sortable: true },
          { key: "action", header: "Action", render: () => "Edit" },
        ]}
        getRowKey={(row) => row.id}
        emptyText="No users found."
        searchable={false}
      />
    </div>
  )
}

function Field({
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
  options: string[]
  placeholder: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

