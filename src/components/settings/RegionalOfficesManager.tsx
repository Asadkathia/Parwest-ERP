"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"
import { Pencil, Check, X, MapPin } from "lucide-react"

type Region = { id: string; name: string }
type OfficeRow = {
  id: string
  name: string
  seriesCode: string
  officeHead?: string | null
  phone?: string | null
  mobile?: string | null
  fax?: string | null
  latitude?: number | null
  longitude?: number | null
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
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [regionId, setRegionId] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editLat, setEditLat] = useState("")
  const [editLng, setEditLng] = useState("")
  const [editSaving, setEditSaving] = useState(false)

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
          latitude: latitude.trim() || null,
          longitude: longitude.trim() || null,
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
      setLatitude("")
      setLongitude("")
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

  const startEdit = (row: OfficeRow) => {
    setEditId(row.id)
    setEditLat(row.latitude != null ? String(row.latitude) : "")
    setEditLng(row.longitude != null ? String(row.longitude) : "")
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditLat("")
    setEditLng("")
  }

  const saveEdit = async (id: string) => {
    setEditSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/regional-offices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: editLat.trim() || null,
          longitude: editLng.trim() || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to update coordinates.")

      setNotice("Coordinates updated. Map pins will refresh on next dashboard load.")
      setEditId(null)
      // Update row locally without full reload
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                latitude: editLat.trim() ? parseFloat(editLat) : null,
                longitude: editLng.trim() ? parseFloat(editLng) : null,
              }
            : r
        )
      )
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update coordinates.")
    } finally {
      setEditSaving(false)
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
          <Input label="Latitude (optional)" value={latitude} onChange={setLatitude} placeholder="e.g. 31.5204" />
          <Input label="Longitude (optional)" value={longitude} onChange={setLongitude} placeholder="e.g. 74.3587" />
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
            key: "coordinates",
            header: "Coordinates",
            render: (row) => {
              if (editId === row.id) {
                return (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="any"
                      value={editLat}
                      onChange={(e) => setEditLat(e.target.value)}
                      placeholder="Lat"
                      className="ui-input w-24 py-1 text-xs"
                    />
                    <input
                      type="number"
                      step="any"
                      value={editLng}
                      onChange={(e) => setEditLng(e.target.value)}
                      placeholder="Lng"
                      className="ui-input w-24 py-1 text-xs"
                    />
                    <button
                      onClick={() => void saveEdit(row.id)}
                      disabled={editSaving}
                      className="text-emerald-600 hover:text-emerald-800 disabled:opacity-40"
                      title="Save"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-[var(--text-muted)] hover:text-[var(--text)]"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )
              }

              const hasCoords = row.latitude != null && row.longitude != null
              return (
                <div className="flex items-center gap-2">
                  {hasCoords ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <MapPin className="h-3 w-3" />
                      {row.latitude?.toFixed(4)}, {row.longitude?.toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">No coords</span>
                  )}
                  <button
                    onClick={() => startEdit(row)}
                    className="text-[var(--brand)] hover:text-[var(--brand-hover)]"
                    title="Edit coordinates"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            },
          },
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