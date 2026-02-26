"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"

type Region = { id: string; name: string }
type OfficeRow = {
  id: string
  name: string
  seriesCode: string
  officeHead?: string | null
  phone?: string | null
  mobile?: string | null
  fax?: string | null
  regionId: string
  region?: Region | null
  createdAt: string
}

export default function RegionalOfficesManager() {
  const [rows, setRows] = useState<OfficeRow[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [office, setOffice] = useState("")
  const [officeHead, setOfficeHead] = useState("")
  const [seriesCode, setSeriesCode] = useState("")
  const [phone, setPhone] = useState("")
  const [mobile, setMobile] = useState("")
  const [fax, setFax] = useState("")
  const [regionId, setRegionId] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [officesRes, regionsRes] = await Promise.all([
        fetch("/api/regional-offices", { cache: "no-store" }),
        fetch("/api/regions", { cache: "no-store" }),
      ])
      const [officesJson, regionsJson] = await Promise.all([
        officesRes.json().catch(() => []),
        regionsRes.json().catch(() => []),
      ])
      if (!officesRes.ok) throw new Error(officesJson?.message || "Failed to fetch offices.")
      if (!regionsRes.ok) throw new Error(regionsJson?.message || "Failed to fetch regions.")

      setRows(Array.isArray(officesJson) ? officesJson : [])
      setRegions(Array.isArray(regionsJson) ? regionsJson : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings data.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) =>
      `${row.name} ${row.seriesCode} ${row.region?.name || ""} ${row.officeHead || ""}`
        .toLowerCase()
        .includes(q)
    )
  }, [rows, search])

  const onCreate = async () => {
    setNotice("")
    setError("")

    if (!office.trim() || !seriesCode.trim() || !regionId) {
      setError("Office name, series code, and region are required.")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/regional-offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: office.trim(),
          officeHead: officeHead.trim() || null,
          seriesCode: seriesCode.trim().toUpperCase(),
          phone: phone.trim() || null,
          mobile: mobile.trim() || null,
          fax: fax.trim() || null,
          regionId,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to create office.")

      setNotice("Regional office created.")
      setOffice("")
      setOfficeHead("")
      setSeriesCode("")
      setPhone("")
      setMobile("")
      setFax("")
      setRegionId("")
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create office.")
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string) => {
    setNotice("")
    setError("")
    try {
      const response = await fetch(`/api/regional-offices/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to delete office.")
      setNotice("Regional office deleted.")
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete office.")
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Settings: Regional Offices" subtitle="Manage specific offices within regions." />
      {notice ? <InlineAlert type="success" message={notice} /> : null}
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Office Name *" value={office} onChange={setOffice} placeholder="Office name" />
          <Input label="Office Head" value={officeHead} onChange={setOfficeHead} placeholder="Office head" />
          <Input label="Series Code *" value={seriesCode} onChange={setSeriesCode} placeholder="LHR" />
          <Input label="Phone" value={phone} onChange={setPhone} placeholder="Phone" />
          <Input label="Mobile" value={mobile} onChange={setMobile} placeholder="Mobile" />
          <Input label="Fax" value={fax} onChange={setFax} placeholder="Fax" />
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Region *</label>
            <select className="ui-select" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              <option value="">Select Region</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          <Input label="Search" value={search} onChange={setSearch} placeholder="Search" />
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={onCreate} disabled={saving}>
            {saving ? "Saving..." : "Create"}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={filtered}
        columns={[
          { key: "name", header: "Office", sortable: true },
          { key: "seriesCode", header: "Series Code", sortable: true },
          { key: "region", header: "Region", render: (row) => <StatusChip label={row.region?.name || "—"} variant="neutral" />, sortable: true },
          { key: "officeHead", header: "Office Head", render: (row) => row.officeHead || "—", sortable: true },
          {
            key: "action",
            header: "Action",
            render: (row) => (
              <button className="text-red-600 hover:underline" onClick={() => void onDelete(row.id)}>
                Delete
              </button>
            ),
          },
        ]}
        rowKey="id"
        searchable={false}
        stickyHeader
        emptyText={loading ? "Loading offices..." : "No offices found."}
      />
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="block text-sm text-[var(--text-muted)] mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="ui-input" placeholder={placeholder} />
    </div>
  )
}
