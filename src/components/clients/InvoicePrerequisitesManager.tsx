"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import ActionButton from "@/components/ui/action-button"
import EmptyState from "@/components/ui/empty-state"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type RegionOption = { id: string; name: string }

type RateRow = {
  id: string
  province: string
  city: string
  guardType: string
  effectiveRate: number
  enqueue: "Yes" | "No"
}

type RegionRow = { id: string; name: string }
type BranchRow = { id: string; name: string }
type ApiRate = {
  id: string
  region?: { name?: string | null } | null
  branch?: { name?: string | null } | null
  deployAs?: string | null
  guardType?: string | null
  salary?: number | string | null
  shiftType?: string | null
}
type ApiRegion = { id: string; name: string }
type ApiBranch = { id: string; name: string }

const TABS = ["Default Rates", "Client Provinces", "Client Cities", "Guard Types", "Invoice Header"] as const
const GUARD_TYPE_OPTIONS = ["Guard", "Supervisor", "CPO", "SO", "ASO", "LSO", "Receptionist", "CCTV Operator", "Complaint Receiver"]

export default function InvoicePrerequisitesManager({
  regions: regionOptions = [],
  locked = false,
}: {
  regions?: RegionOption[]
  locked?: boolean
} = {}) {
  const searchParams = useSearchParams()
  const urlRegionId = searchParams?.get("regionId") || ""
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Default Rates")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [guardType, setGuardType] = useState("")
  const [effectiveRate, setEffectiveRate] = useState("")
  const [enqueue, setEnqueue] = useState<"Yes" | "No">("Yes")
  const [entries, setEntries] = useState("10")
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<RateRow[]>([])
  const [regions, setRegions] = useState<RegionRow[]>([])
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [invoiceHeaderName, setInvoiceHeaderName] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [editingRate, setEditingRate] = useState<RateRow | null>(null)
  const [editRateValue, setEditRateValue] = useState("")

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const regionQs = urlRegionId ? `?regionId=${encodeURIComponent(urlRegionId)}` : ""
        const [ratesRes, regionsRes, branchesRes] = await Promise.all([
          fetch("/api/deployment-rates", { cache: "no-store" }),
          // /api/regions auto-scopes to user's region for REGIONAL users.
          fetch("/api/regions", { cache: "no-store" }),
          // /api/branches accepts regionId — pass URL regionId so SuperAdmin's
          // selection narrows the dropdown; REGIONAL users are auto-scoped server-side.
          fetch(`/api/branches${regionQs}`, { cache: "no-store" }),
        ])

        const [ratesData, regionsData, branchesData] = await Promise.all([ratesRes.json(), regionsRes.json(), branchesRes.json()])
        if (!ratesRes.ok) {
          if (isMounted) setError(ratesData?.message || "Failed to load default rates.")
          return
        }

        if (isMounted) {
          setRows(
            Array.isArray(ratesData)
              ? (ratesData as ApiRate[]).map((row) => ({
                  id: String(row.id),
                  province: String(row?.region?.name || "All Pakistan"),
                  city: String(row?.deployAs || row?.branch?.name || "All"),
                  guardType: String(row?.guardType || "Guard"),
                  effectiveRate: Number(row?.salary || 0),
                  enqueue: row?.shiftType === "BOTH" ? "Yes" : "No",
                }))
              : []
          )
          setRegions(Array.isArray(regionsData) ? (regionsData as ApiRegion[]).map((r) => ({ id: String(r.id), name: String(r.name) })) : [])
          setBranches(Array.isArray(branchesData) ? (branchesData as ApiBranch[]).map((b) => ({ id: String(b.id), name: String(b.name) })) : [])
        }
      } catch {
        if (isMounted) setError("Failed to load invoice prerequisites.")
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [urlRegionId])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (province && row.province !== province) return false
      if (city && row.city !== city) return false
      if (guardType && row.guardType !== guardType) return false
      if (search && !`${row.province} ${row.city} ${row.guardType}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [rows, province, city, guardType, search])

  const onSave = async () => {
    setError("")
    if (!province || !city || !guardType || !effectiveRate) {
      setError("Province, city, guard type and effective rate are required.")
      return
    }

    const regionId = regions.find((r) => r.name === province)?.id
    const payload = {
      regionId: regionId || undefined,
      deployAs: city,
      guardType,
      salary: Number(effectiveRate),
      shiftType: enqueue === "Yes" ? "BOTH" : "DAY",
    }

    const response = await fetch("/api/deployment-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data?.message || "Failed to save default rate.")
      return
    }

    setRows((prev) => [
      {
        id: String(data.id),
        province: String(data?.region?.name || province),
        city: String(data?.deployAs || city),
        guardType: String(data?.guardType || guardType),
        effectiveRate: Number(data?.salary || effectiveRate),
        enqueue: data?.shiftType === "BOTH" ? "Yes" : "No",
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

  const onApplyEditRate = async () => {
    if (!editingRate) return
    setError("")
    const parsed = Number.parseFloat(editRateValue)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a valid non-negative rate.")
      return
    }

    const response = await fetch(`/api/deployment-rates/${editingRate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salary: parsed }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data?.message || "Failed to update rate.")
      return
    }

    setRows((prev) =>
      prev.map((row) => (row.id === editingRate.id ? { ...row, effectiveRate: Number(data?.salary || parsed) } : row))
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

  const provinceRows = useMemo(
    () => [...new Set(rows.map((row) => row.province))].map((name, index) => ({ id: String(index + 1), provinceName: name })),
    [rows]
  )
  const cityRows = useMemo(
    () => [...new Set(rows.map((row) => `${row.city}__${row.province}`))].map((key, index) => {
      const [cityName, provinceName] = key.split("__")
      return { id: String(index + 1), cityName, province: provinceName }
    }),
    [rows]
  )
  const guardTypeRows = useMemo(
    () => [...new Set(rows.map((row) => row.guardType))].map((name, index) => ({ id: String(index + 1), guardTypeName: name, enqueue })),
    [rows, enqueue]
  )

  const tabClass = (tab: (typeof TABS)[number]) =>
    `px-3 py-1.5 text-sm rounded-full border transition ${
      activeTab === tab
        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
        : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]"
    }`

  return (
    <div className="space-y-6">
      <SectionTitle title="Contract Default Rates" subtitle="Client Invoice Pre-requisites" />
      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

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
              <RegionUrlPicker
                regions={regionOptions}
                locked={locked}
                includeGlobalOption={!locked}
              />
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Province</label>
                <select value={province} onChange={(e) => setProvince(e.target.value)} className="ui-select">
                  <option value="">--Select Province--</option>
                  {regions.map((option) => (
                    <option key={option.id} value={option.name}>{option.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select City / Branch</label>
                <select value={city} onChange={(e) => setCity(e.target.value)} className="ui-select">
                  <option value="">--Select City / Branch--</option>
                  {branches.map((option) => (
                    <option key={option.id} value={option.name}>{option.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Guard Type</label>
                <select value={guardType} onChange={(e) => setGuardType(e.target.value)} className="ui-select">
                  <option value="">--Guard Type--</option>
                  {GUARD_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Effective Rate</label>
                <input type="number" value={effectiveRate} onChange={(e) => setEffectiveRate(e.target.value)} className="ui-input" placeholder="Effective Rate" />
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
                <label className="block text-sm text-[var(--text-muted)] mb-1">Entries</label>
                <select value={entries} onChange={(e) => setEntries(e.target.value)} className="ui-select">
                  {["10", "25", "50", "100", "200"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Search</label>
                <input value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input" placeholder="Search" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={onSave}>Submit</ActionButton>
              <ActionButton variant="secondary" onClick={resetDefaults}>Reset</ActionButton>
            </div>
          </FilterBar>

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
                  <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => onEditRate(row)}>
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
        <DataTable
          rows={provinceRows}
          columns={[
            { key: "id", header: "ID", sortable: true },
            { key: "provinceName", header: "Province Name", sortable: true },
          ]}
          getRowKey={(row) => row.id}
          searchable={false}
          emptyText="No provinces found."
        />
      ) : activeTab === "Client Cities" ? (
        <DataTable
          rows={cityRows}
          columns={[
            { key: "id", header: "ID", sortable: true },
            { key: "cityName", header: "City Name", sortable: true },
            { key: "province", header: "Province", sortable: true },
          ]}
          getRowKey={(row) => row.id}
          searchable={false}
          emptyText="No cities found."
        />
      ) : activeTab === "Guard Types" ? (
        <DataTable
          rows={guardTypeRows}
          columns={[
            { key: "id", header: "ID", sortable: true },
            { key: "guardTypeName", header: "Guard Type Name", sortable: true },
            { key: "enqueue", header: "Enqueue", sortable: true },
          ]}
          getRowKey={(row) => row.id}
          searchable={false}
          emptyText="No guard types found."
        />
      ) : (
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
          <EmptyState title="Invoice Header" description="Header presets can be managed here in frontend mode." />
        </FilterBar>
      )}

      {editingRate ? (
        <FormDialog title="Edit Rate" onClose={() => setEditingRate(null)}>
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              {editingRate.province} / {editingRate.city} / {editingRate.guardType}
            </p>
            <label className="block text-sm text-[var(--text-muted)]">Effective Rate</label>
            <input type="number" className="ui-input" value={editRateValue} onChange={(e) => setEditRateValue(e.target.value)} placeholder="Effective Rate" />
            <div className="flex justify-end gap-2">
              <ActionButton variant="secondary" onClick={() => setEditingRate(null)}>Cancel</ActionButton>
              <ActionButton onClick={onApplyEditRate}>Save</ActionButton>
            </div>
          </div>
        </FormDialog>
      ) : null}
    </div>
  )
}

function FormDialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
          <button type="button" className="text-[var(--text-muted)] hover:text-[var(--text)]" onClick={onClose}>X</button>
        </div>
        {children}
      </div>
    </div>
  )
}
