"use client"

import { useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"

type Row = {
  id: string
  name: string
  description?: string
  createdAt?: string
  createdBy?: string
}

type Props = {
  title: string
  subtitle?: string
  label: string
  includeDescription?: boolean
  rows: Row[]
  columns: string[]
}

export default function MasterDataManager({
  title,
  subtitle,
  label,
  includeDescription = false,
  rows,
  columns,
}: Props) {
  const [data, setData] = useState<Row[]>(rows)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    if (!query) return data
    return data.filter((row) => {
      if (row.name.toLowerCase().includes(query.toLowerCase())) return true
      if ((row.description || "").toLowerCase().includes(query.toLowerCase())) return true
      return false
    })
  }, [data, query])

  const onCreate = () => {
    if (!name.trim()) return

    setData((prev) => [
      {
        id: String(prev.length + 1),
        name: name.trim(),
        description: includeDescription ? description.trim() || undefined : undefined,
        createdAt: new Date().toISOString().slice(0, 10),
        createdBy: "ADMIN",
      },
      ...prev,
    ])

    setName("")
    setDescription("")
  }

  const onDelete = (id: string) => {
    setData((prev) => prev.filter((row) => row.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle title={title} subtitle={subtitle} />
      </div>

      <FilterBar className="space-y-4">
        <div className={`grid grid-cols-1 ${includeDescription ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">{label}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="ui-input" placeholder={label} />
          </div>
          {includeDescription ? (
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="ui-input" placeholder="Description" />
            </div>
          ) : null}
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="ui-input" placeholder="Search" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onCreate}>Create</ActionButton>
          <ActionButton variant="secondary">Update</ActionButton>
          <ActionButton variant="secondary">Delete</ActionButton>
        </div>
      </FilterBar>

      <div className="ui-card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No records found.</td></tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="px-4 py-3 text-sm">{row.name}</td>
                  {columns.some((c) => c.toLowerCase().includes("description")) ? <td className="px-4 py-3 text-sm">{row.description || "—"}</td> : null}
                  {columns.some((c) => c.toLowerCase().includes("created at") || c.toLowerCase().includes("created on")) ? (
                    <td className="px-4 py-3 text-sm">{row.createdAt || "—"}</td>
                  ) : null}
                  {columns.some((c) => c.toLowerCase().includes("created by") || c.toLowerCase().includes("added by")) ? (
                    <td className="px-4 py-3 text-sm">{row.createdBy || "ADMIN"}</td>
                  ) : null}
                  <td className="px-4 py-3 text-sm text-red-600 cursor-pointer" onClick={() => onDelete(row.id)}>Delete</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
