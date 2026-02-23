"use client"

import { type ReactNode, useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import EmptyState from "@/components/ui/empty-state"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type RateRow = {
  id: string
  province: string
  city: string
  guardType: string
  effectiveRate: number
  enqueue: "Yes" | "No"
}

const TABS = ["Default Rates", "Client Provinces", "Client Cities", "Guard Types", "Invoice Header"] as const
const PROVINCE_OPTIONS = ["All Pakistan", "Punjab", "Sindh", "Balochistan", "KPK", "ICT Islamabad", "Gilgit Baltistan", "AJK Kashmir"]
const CITY_OPTIONS = ["Lahore", "Karachi", "Gujranwala", "Multan", "Faisalabad", "Islamabad", "Peshawar", "Quetta"]
const GUARD_TYPE_OPTIONS = ["Guard", "location supervisor", "cpo", "SO", "ASO", "LSO", "Receptionist", "CCTV Operator", "Complaint Receiver"]

const initialRates: RateRow[] = [
  { id: "1", province: "Punjab", city: "Lahore", guardType: "Guard", effectiveRate: 35000, enqueue: "Yes" },
  { id: "2", province: "Punjab", city: "Gujranwala", guardType: "Supervisor", effectiveRate: 48000, enqueue: "No" },
  { id: "3", province: "Sindh", city: "Karachi", guardType: "Guard", effectiveRate: 37000, enqueue: "Yes" },
]

export default function InvoicePrerequisitesManager() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Default Rates")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [guardType, setGuardType] = useState("")
  const [effectiveRate, setEffectiveRate] = useState("")
  const [enqueue, setEnqueue] = useState<"Yes" | "No">("Yes")
  const [entries, setEntries] = useState("10")
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<RateRow[]>(initialRates)
  const [name, setName] = useState("")
  const [provinceName, setProvinceName] = useState("")
  const [cityName, setCityName] = useState("")
  const [guardTypeName, setGuardTypeName] = useState("")
  const [invoiceHeaderName, setInvoiceHeaderName] = useState("")
  const [notice, setNotice] = useState("")
  const [confirmAction, setConfirmAction] = useState<null | "reset" | "submit-default">(
    null
  )
  const [editingRate, setEditingRate] = useState<RateRow | null>(null)
  const [editRateValue, setEditRateValue] = useState("")

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (province && row.province !== province) return false
      if (city && row.city !== city) return false
      if (guardType && row.guardType !== guardType) return false
      if (search && !`${row.province} ${row.city} ${row.guardType}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [rows, province, city, guardType, search])

  const onSave = () => {
    if (!province || !city || !guardType || !effectiveRate) return

    setRows((prev) => [
      {
        id: String(prev.length + 1),
        province,
        city,
        guardType,
        effectiveRate: Number(effectiveRate),
        enqueue,
      },
      ...prev,
    ])
    setEffectiveRate("")
    setNotice("Default rate submitted.")
  }

  const onEditRate = (row: RateRow) => {
    setEditingRate(row)
    setEditRateValue(String(row.effectiveRate))
  }

  const onApplyEditRate = () => {
    if (!editingRate) return
    const parsed = Number.parseFloat(editRateValue)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setNotice("Enter a valid rate before submit.")
      return
    }
    setRows((prev) =>
      prev.map((row) =>
        row.id === editingRate.id ? { ...row, effectiveRate: parsed } : row
      )
    )
    setEditingRate(null)
    setEditRateValue("")
    setNotice("Rate updated.")
  }

  const resetDefaults = () => {
    setProvince("")
    setCity("")
    setGuardType("")
    setEffectiveRate("")
    setEnqueue("Yes")
    setEntries("10")
    setSearch("")
    setNotice("Filters reset.")
  }

  const clientProvinceRows = useMemo(
    () =>
      [...new Set(rows.map((row) => row.province))]
        .filter((item) => !provinceName || item.toLowerCase().includes(provinceName.toLowerCase()))
        .map((item, index) => ({ id: String(index + 1), provinceName: item })),
    [rows, provinceName]
  )

  const clientCityRows = useMemo(
    () =>
      rows
        .filter((row) => !cityName || row.city.toLowerCase().includes(cityName.toLowerCase()))
        .map((row, index) => ({ id: String(index + 1), cityName: row.city, province: row.province })),
    [rows, cityName]
  )

  const guardTypeRows = useMemo(
    () =>
      [...new Set(rows.map((row) => row.guardType))]
        .filter((item) => !guardTypeName || item.toLowerCase().includes(guardTypeName.toLowerCase()))
        .map((item, index) => ({ id: String(index + 1), guardTypeName: item, enqueue })),
    [rows, guardTypeName, enqueue]
  )

  const tabClass = (tab: (typeof TABS)[number]) =>
    `px-3 py-1.5 text-sm rounded-full border transition ${
      activeTab === tab
        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
        : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]"
    }`

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Contract Default Rates"
        subtitle="Client Invoice Pre-requisites"
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
                  <option value="">--Select Province--</option>
                  {PROVINCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select City</label>
                <select value={city} onChange={(e) => setCity(e.target.value)} className="ui-select">
                  <option value="">--Select City--</option>
                  {CITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Guard Type</label>
                <select value={guardType} onChange={(e) => setGuardType(e.target.value)} className="ui-select">
                  <option value="">--Guard Type--</option>
                  {GUARD_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Effective Rate</label>
                <input
                  type="number"
                  value={effectiveRate}
                  onChange={(e) => setEffectiveRate(e.target.value)}
                  className="ui-input"
                  placeholder="Effective Rate"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Enqueue</label>
                <select value={enqueue} onChange={(e) => setEnqueue(e.target.value as "Yes" | "No")} className="ui-select">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Show 102550100200 entries</label>
                <select value={entries} onChange={(e) => setEntries(e.target.value)} className="ui-select">
                  {["10", "25", "50", "100", "200"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Search:</label>
                <input value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input" placeholder="Search:" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={() => setNotice("Search applied.")}>SEARCH!</ActionButton>
              <ActionButton variant="secondary" onClick={() => setConfirmAction("reset")}>
                Reset
              </ActionButton>
              <ActionButton variant="secondary" onClick={() => setConfirmAction("submit-default")}>
                Submit
              </ActionButton>
            </div>
          </FilterBar>
          {notice ? <InlineAlert type="success" message={notice} /> : null}

          <DataTable
            rows={filteredRows.slice(0, Number.parseInt(entries, 10) || 10)}
            columns={[
              { key: "province", header: "Client Province", sortable: true },
              { key: "city", header: "Client Cities", sortable: true },
              { key: "guardType", header: "Guard Types", sortable: true },
              { key: "effectiveRate", header: "Effective Rate", render: (row) => row.effectiveRate.toLocaleString(), sortable: true },
              { key: "enqueue", header: "Enqueue", sortable: true },
              {
                key: "action",
                header: "Edit Rate",
                render: (row) => (
                  <button
                    type="button"
                    className="text-[var(--brand)] hover:underline"
                    onClick={() => onEditRate(row)}
                  >
                    Edit
                  </button>
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            emptyText="No rates found."
            searchable={false}
          />
        </>
      ) : activeTab === "Client Provinces" ? (
        <FilterBar className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="ui-input" placeholder="Name" />
            </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Province</label>
                <input value={provinceName} onChange={(e) => setProvinceName(e.target.value)} className="ui-input" placeholder="Province" />
              </div>
              <div className="flex items-end">
                <ActionButton onClick={() => setNotice("Client province saved.")}>Submit</ActionButton>
              </div>
            </div>
            <DataTable
            rows={clientProvinceRows.slice(0, Number.parseInt(entries, 10) || 10)}
            columns={[
              { key: "id", header: "ID", sortable: true },
              { key: "provinceName", header: "Province Name", sortable: true },
            ]}
            getRowKey={(row) => row.id}
            searchable={false}
            emptyText="No provinces found."
          />
          {notice ? <InlineAlert type="success" message={notice} /> : null}
        </FilterBar>
      ) : activeTab === "Client Cities" ? (
        <FilterBar className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="ui-input" placeholder="Name" />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">Province</label>
              <input value={cityName} onChange={(e) => setCityName(e.target.value)} className="ui-input" placeholder="Province" />
            </div>
              <div className="flex items-end">
                <ActionButton onClick={() => setNotice("Client city saved.")}>Submit</ActionButton>
              </div>
            </div>
            <DataTable
            rows={clientCityRows.slice(0, Number.parseInt(entries, 10) || 10)}
            columns={[
              { key: "id", header: "ID", sortable: true },
              { key: "cityName", header: "City Name", sortable: true },
              { key: "province", header: "Province", sortable: true },
            ]}
            getRowKey={(row) => row.id}
            searchable={false}
            emptyText="No cities found."
          />
          {notice ? <InlineAlert type="success" message={notice} /> : null}
        </FilterBar>
      ) : activeTab === "Guard Types" ? (
        <FilterBar className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
              <input value={guardTypeName} onChange={(e) => setGuardTypeName(e.target.value)} className="ui-input" placeholder="Name" />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">Enqueue</label>
              <select className="ui-select" value={enqueue} onChange={(e) => setEnqueue(e.target.value as "Yes" | "No")}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
              <div className="flex items-end">
                <ActionButton onClick={() => setNotice("Guard type saved.")}>Submit</ActionButton>
              </div>
            </div>
            <DataTable
            rows={guardTypeRows.slice(0, Number.parseInt(entries, 10) || 10)}
            columns={[
              { key: "id", header: "ID", sortable: true },
              { key: "guardTypeName", header: "Guard Type Name", sortable: true },
              { key: "enqueue", header: "Enqueue", sortable: true },
            ]}
            getRowKey={(row) => row.id}
            searchable={false}
            emptyText="No guard types found."
          />
          {notice ? <InlineAlert type="success" message={notice} /> : null}
        </FilterBar>
      ) : activeTab === "Invoice Header" ? (
        <FilterBar className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
              <input value={invoiceHeaderName} onChange={(e) => setInvoiceHeaderName(e.target.value)} className="ui-input" placeholder="Name" />
            </div>
            <div className="flex items-end">
              <ActionButton onClick={() => setNotice("Invoice header saved.")}>Submit</ActionButton>
            </div>
          </div>
          {notice ? <InlineAlert type="success" message={notice} /> : null}
          <EmptyState title="Invoice Header" description="Header presets can be managed here in frontend mode." />
        </FilterBar>
      ) : (
        <EmptyState title="No data" description="No records found." />
      )}

      {confirmAction ? (
        <ConfirmDialog
          title={confirmAction === "reset" ? "Reset Filters" : "Submit Default Rate"}
          message={
            confirmAction === "reset"
              ? "Are you sure you want to reset all filter fields?"
              : "Are you sure you want to submit this default rate?"
          }
          onNo={() => setConfirmAction(null)}
          onYes={() => {
            if (confirmAction === "reset") {
              resetDefaults()
            } else {
              onSave()
            }
            setConfirmAction(null)
          }}
        />
      ) : null}

      {editingRate ? (
        <FormDialog title="Edit Rate" onClose={() => setEditingRate(null)}>
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              {editingRate.province} / {editingRate.city} / {editingRate.guardType}
            </p>
            <label className="block text-sm text-[var(--text-muted)]">Effective Rate</label>
            <input
              type="number"
              className="ui-input"
              value={editRateValue}
              onChange={(e) => setEditRateValue(e.target.value)}
              placeholder="Effective Rate"
            />
            <div className="flex justify-end gap-2">
              <ActionButton variant="secondary" onClick={() => setEditingRate(null)}>
                Close
              </ActionButton>
              <ActionButton onClick={onApplyEditRate}>Submit</ActionButton>
            </div>
          </div>
        </FormDialog>
      ) : null}
    </div>
  )
}

function ConfirmDialog({
  title,
  message,
  onYes,
  onNo,
}: {
  title: string
  message: string
  onYes: () => void
  onNo: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
        <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <ActionButton variant="secondary" onClick={onNo}>
            No
          </ActionButton>
          <ActionButton onClick={onYes}>Yes</ActionButton>
        </div>
      </div>
    </div>
  )
}

function FormDialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
