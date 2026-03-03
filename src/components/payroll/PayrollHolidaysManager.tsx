"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type HolidayRow = {
  id: string
  name: string
  date: string
  notes?: string | null
  createdAt?: string
}

export default function PayrollHolidaysManager() {
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback
  const [rows, setRows] = useState<HolidayRow[]>([])
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [notes, setNotes] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const response = await fetch("/api/payroll/holidays", { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to load holidays.")
      setRows(Array.isArray(payload) ? payload : [])
    } catch (error: unknown) {
      setRows([])
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to load holidays.") })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    setNotice(null)
    if (!name.trim() || !date) {
      setNotice({ type: "error", message: "Holiday name and date are required." })
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/payroll/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          date,
          notes: notes.trim() || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to create holiday.")
      setName("")
      setDate("")
      setNotes("")
      setNotice({ type: "success", message: "Holiday created." })
      await load()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to create holiday.") })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setNotice(null)
    try {
      const response = await fetch(`/api/payroll/holidays/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to delete holiday.")
      setNotice({ type: "success", message: "Holiday deleted." })
      await load()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to delete holiday.") })
    }
  }

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) => `${row.name} ${row.notes || ""}`.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="space-y-6">
      <SectionTitle title="Holidays" subtitle="Create and manage payroll holidays." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Holiday Name *" value={name} onChange={setName} placeholder="Holiday name" />
          <Input label="Date *" value={date} onChange={setDate} placeholder="" type="date" />
          <Input label="Notes" value={notes} onChange={setNotes} placeholder="Notes" />
          <Input label="Search" value={search} onChange={setSearch} placeholder="Search holidays" />
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={create} disabled={saving}>{saving ? "Saving..." : "Create"}</ActionButton>
          <ActionButton variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={filteredRows}
        columns={[
          { key: "name", header: "Holiday", sortable: true },
          { key: "date", header: "Date", sortable: true, render: (row) => new Date(row.date).toLocaleDateString("en-US") },
          { key: "notes", header: "Notes", render: (row) => row.notes || "—" },
          {
            key: "action",
            header: "Action",
            render: (row) => (
              <button className="text-red-600 hover:underline" onClick={() => void remove(row.id)}>
                Delete
              </button>
            ),
          },
        ]}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading holidays..." : "No holidays found."}
      />
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: "text" | "date"
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input
        className="ui-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}
