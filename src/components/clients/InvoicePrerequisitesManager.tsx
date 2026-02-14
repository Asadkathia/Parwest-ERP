"use client"

import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import EmptyState from "@/components/ui/empty-state"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"

type RateRow = {
  id: string
  province: string
  city: string
  guardType: string
  ratePerMonth: number
}

const TABS = ["Default Rates", "Client Provinces", "Client Cities", "Guard Types", "Invoice Header"] as const

const initialRates: RateRow[] = [
  { id: "1", province: "Punjab", city: "Lahore", guardType: "Guard", ratePerMonth: 35000 },
  { id: "2", province: "Punjab", city: "Gujranwala", guardType: "Supervisor", ratePerMonth: 48000 },
  { id: "3", province: "Sindh", city: "Karachi", guardType: "Guard", ratePerMonth: 37000 },
]

export default function InvoicePrerequisitesManager() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Default Rates")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [guardType, setGuardType] = useState("")
  const [ratePerMonth, setRatePerMonth] = useState("")
  const [rows, setRows] = useState<RateRow[]>(initialRates)

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (province && row.province !== province) return false
      if (city && row.city !== city) return false
      if (guardType && row.guardType !== guardType) return false
      return true
    })
  }, [rows, province, city, guardType])

  const onSave = () => {
    if (!province || !city || !guardType || !ratePerMonth) return

    setRows((prev) => [
      {
        id: String(prev.length + 1),
        province,
        city,
        guardType,
        ratePerMonth: Number(ratePerMonth),
      },
      ...prev,
    ])
    setRatePerMonth("")
  }

  const tabClass = (tab: (typeof TABS)[number]) =>
    `px-3 py-1.5 text-sm rounded-full border transition ${
      activeTab === tab
        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
        : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]"
    }`

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Client Invoice Prerequisites"
        subtitle="Manage default rates, provinces, cities, guard types, and invoice header settings."
      />

      <FilterBar className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={tabClass(tab)}>
              {tab}
            </button>
          ))}
        </div>
      </FilterBar>

      {activeTab === "Default Rates" ? (
        <>
          <FilterBar className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Province</label>
                <select value={province} onChange={(e) => setProvince(e.target.value)} className="ui-select">
                  <option value="">All Provinces</option>
                  <option value="Punjab">Punjab</option>
                  <option value="Sindh">Sindh</option>
                  <option value="KPK">KPK</option>
                  <option value="Balochistan">Balochistan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="ui-input" placeholder="City" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Guard Type</label>
                <select value={guardType} onChange={(e) => setGuardType(e.target.value)} className="ui-select">
                  <option value="">All Types</option>
                  <option value="Guard">Guard</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="CPO">CPO</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Rate/Month</label>
                <input
                  type="number"
                  value={ratePerMonth}
                  onChange={(e) => setRatePerMonth(e.target.value)}
                  className="ui-input"
                  placeholder="Rate"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton>SEARCH!</ActionButton>
              <ActionButton variant="secondary" onClick={onSave}>SAVE</ActionButton>
            </div>
          </FilterBar>

          <DataTable
            rows={filteredRows}
            columns={[
              { key: "province", header: "Client Province", sortable: true },
              { key: "city", header: "Client City", sortable: true },
              { key: "guardType", header: "Guard Type", sortable: true },
              { key: "ratePerMonth", header: "Rate/Month", render: (row) => row.ratePerMonth.toLocaleString(), sortable: true },
              { key: "action", header: "Action", render: () => <span className="text-[var(--brand)]">Edit</span> },
            ]}
            getRowKey={(row) => row.id}
            emptyText="No rates found."
            searchable={false}
          />
        </>
      ) : (
        <EmptyState
          title={`${activeTab} UI scaffold is ready`}
          description="This section is styled and prepared for full frontend parity wiring in the next pass."
        />
      )}
    </div>
  )
}
