"use client"

import { useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"

const TABS = ["Categories", "Priorities", "Statuses"] as const

type Item = { id: string; name: string; description?: string; color: string }

const initial: Record<(typeof TABS)[number], Item[]> = {
  Categories: [
    { id: "1", name: "General", description: "General requests", color: "#3B82F6" },
    { id: "2", name: "Server", description: "Server issues", color: "#EF4444" },
  ],
  Priorities: [
    { id: "1", name: "Low", color: "#10B981" },
    { id: "2", name: "High", color: "#EF4444" },
  ],
  Statuses: [
    { id: "1", name: "New", color: "#3B82F6" },
    { id: "2", name: "In-Progress", color: "#F59E0B" },
  ],
}

export default function TicketPrerequisitesManager() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Categories")
  const [data, setData] = useState(initial)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("#3B82F6")
  const [search, setSearch] = useState("")

  const rows = useMemo(() => {
    const list = data[activeTab]
    if (!search) return list
    return list.filter((item) => [item.name, item.description || "", item.color].join(" ").toLowerCase().includes(search.toLowerCase()))
  }, [data, activeTab, search])

  const onSave = () => {
    if (!name.trim()) return

    setData((prev) => ({
      ...prev,
      [activeTab]: [
        {
          id: String(prev[activeTab].length + 1),
          name: name.trim(),
          description: activeTab === "Categories" ? description.trim() || undefined : undefined,
          color,
        },
        ...prev[activeTab],
      ],
    }))

    setName("")
    setDescription("")
    setColor("#3B82F6")
  }

  const onDelete = (id: string) => {
    setData((prev) => ({ ...prev, [activeTab]: prev[activeTab].filter((item) => item.id !== id) }))
  }

  const tabClass = (tab: (typeof TABS)[number]) =>
    `px-3 py-1.5 text-sm rounded-full border transition ${
      activeTab === tab
        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
        : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]"
    }`

  return (
    <div className="space-y-6">
      <SectionTitle title="Ticketing Prerequisites" subtitle="Configure categories, priorities, and statuses." />

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
          <ActionButton variant="secondary">Update</ActionButton>
          <ActionButton variant="danger">Delete</ActionButton>
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
                <span className="h-3 w-3 rounded-full border border-[var(--border)]" style={{ backgroundColor: row.color }} />
                <span>{row.color}</span>
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
        emptyText="No records found."
        stickyHeader
      />
    </div>
  )
}
