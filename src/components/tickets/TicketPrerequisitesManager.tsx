"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"

const TABS = ["Categories", "Priorities", "Statuses"] as const

type TabName = (typeof TABS)[number]
type Item = { id: string; name: string; description?: string | null; color?: string | null }

function endpointFor(tab: TabName) {
  if (tab === "Categories") return "/api/tickets/categories"
  if (tab === "Priorities") return "/api/tickets/priorities"
  return "/api/tickets/statuses"
}

export default function TicketPrerequisitesManager() {
  const [activeTab, setActiveTab] = useState<TabName>("Categories")
  const [data, setData] = useState<Record<TabName, Item[]>>({
    Categories: [],
    Priorities: [],
    Statuses: [],
  })
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("#3B82F6")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const loadTab = async (tab: TabName) => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(endpointFor(tab), { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) {
        throw new Error(payload?.message || `Failed to fetch ${tab.toLowerCase()}.`)
      }
      setData((prev) => ({ ...prev, [tab]: Array.isArray(payload) ? payload : [] }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to fetch records.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTab(activeTab)
  }, [activeTab])

  const rows = useMemo(() => {
    const list = data[activeTab]
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter((item) =>
      [item.name, item.description || "", item.color || ""].join(" ").toLowerCase().includes(q)
    )
  }, [data, activeTab, search])

  const clearForm = () => {
    setName("")
    setDescription("")
    setColor("#3B82F6")
  }

  const onSave = async () => {
    setNotice("")
    setError("")
    if (!name.trim()) {
      setError("Name is required.")
      return
    }

    try {
      const payload: Record<string, string> = { name: name.trim(), color }
      if (activeTab === "Categories") payload.description = description.trim()

      const response = await fetch(endpointFor(activeTab), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(json?.message || "Failed to create record.")
      }

      setNotice(`${activeTab.slice(0, -1)} created successfully.`)
      clearForm()
      await loadTab(activeTab)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to create record.")
    }
  }

  const onDelete = async (id: string) => {
    setNotice("")
    setError("")
    try {
      const response = await fetch(`${endpointFor(activeTab)}/${id}`, { method: "DELETE" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(json?.message || "Failed to delete record.")
      }
      setNotice(`${activeTab.slice(0, -1)} deleted successfully.`)
      await loadTab(activeTab)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete record.")
    }
  }

  const tabClass = (tab: TabName) =>
    `px-3 py-1.5 text-sm rounded-full border transition ${
      activeTab === tab
        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
        : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]"
    }`

  return (
    <div className="space-y-6">
      <SectionTitle title="Ticketing Prerequisites" subtitle="Configure categories, priorities, and statuses." />
      {notice ? <InlineAlert type="success" message={notice} /> : null}
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={tabClass(tab)}>
              {tab}
            </button>
          ))}
        </div>
      </FilterBar>

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="ui-input" placeholder="Name" />
          </div>
          {activeTab === "Categories" ? (
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="ui-input" placeholder="Description" />
            </div>
          ) : (
            <div />
          )}
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Color</label>
            <input value={color} onChange={(e) => setColor(e.target.value)} className="ui-input" placeholder="#RRGGBB" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input" placeholder="Search" />
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={onSave}>Save</ActionButton>
          <ActionButton variant="secondary" onClick={clearForm}>
            Reset
          </ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={rows}
        columns={[
          { key: "type", header: "Type", render: () => <StatusChip label={activeTab.slice(0, -1)} variant="neutral" /> },
          { key: "name", header: "Name", sortable: true },
          {
            key: "color",
            header: "Color",
            render: (row) => (
              <div className="inline-flex items-center gap-2 text-sm">
                <span className="h-3 w-3 rounded-full border border-[var(--border)]" style={{ backgroundColor: row.color || "#94A3B8" }} />
                <span>{row.color || "—"}</span>
              </div>
            ),
          },
          {
            key: "action",
            header: "Action",
            render: (row) => (
              <button className="text-red-600 hover:underline" onClick={() => onDelete(row.id)}>
                Delete
              </button>
            ),
          },
        ]}
        getRowKey={(row) => row.id}
        searchable={false}
        emptyText={loading ? "Loading records..." : "No records found."}
        stickyHeader
      />
    </div>
  )
}
