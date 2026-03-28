"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"
import { Pencil, Check, X, MapPin, Map } from "lucide-react"

// Dynamic import — Leaflet requires window
const CoordPickerMap = dynamic(() => import("./CoordPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-[var(--surface-muted)] rounded-[var(--radius-md)]">
      <p className="text-sm text-[var(--text-muted)]">Loading map…</p>
    </div>
  ),
})

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

  // Create form fields
  const [office, setOffice] = useState("")
  const [officeHead, setOfficeHead] = useState("")
  const [seriesCode, setSeriesCode] = useState("")
  const [phone, setPhone] = useState("")
  const [mobile, setMobile] = useState("")
  const [fax, setFax] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [regionId, setRegionId] = useState("")
  const [showCreateMap, setShowCreateMap] = useState(false)

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
  const [showEditMap, setShowEditMap] = useState(false)

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

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) =>
      `${row.name} ${row.seriesCode} ${row.region?.name || ""} ${row.officeHead || ""}`
        .toLowerCase().includes(q)
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
      setOffice(""); setOfficeHead(""); setSeriesCode("")
      setPhone(""); setMobile(""); setFax("")
      setLatitude(""); setLongitude(""); setRegionId("")
      setShowCreateMap(false)
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create office.")
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string) => {
    setNotice(""); setError("")
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
    setShowEditMap(false)
  }

  const cancelEdit = () => {
    setEditId(null); setEditLat(""); setEditLng(""); setShowEditMap(false)
  }

  const saveEdit = async (id: string) => {
    setEditSaving(true); setError("")
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
      setEditId(null); setShowEditMap(false)
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

  const createLatNum = parseFloat(latitude) || null
  const createLngNum = parseFloat(longitude) || null

  return (
    <div className="space-y-6">
      <SectionTitle title="Settings: Regional Offices" subtitle="Manage specific offices within regions." />
      {notice ? <InlineAlert type="success" message={notice} /> : null}
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Region *</label>
            <select className="ui-select" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              <option value="">Select Region</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
          </div>
          <Input label="Office Name *" value={office} onChange={setOffice} placeholder="Office name" />
          <Input label="Series Code *" value={seriesCode} onChange={setSeriesCode} placeholder="LHR" />
          <Input label="Office Head" value={officeHead} onChange={setOfficeHead} placeholder="Office head" />
          <Input label="Phone" value={phone} onChange={setPhone} placeholder="Phone" />
          <Input label="Mobile" value={mobile} onChange={setMobile} placeholder="Mobile" />
          <Input label="Fax" value={fax} onChange={setFax} placeholder="Fax" />

          {/* Lat / Lng with map picker toggle */}
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Latitude (optional)</label>
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="ui-input"
              placeholder="e.g. 31.5204"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Longitude (optional)</label>
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="ui-input"
              placeholder="e.g. 74.3587"
            />
          </div>

          <Input label="Search" value={search} onChange={setSearch} placeholder="Search" />
        </div>

        {/* Map picker toggle for create form */}
        <div>
          <button
            type="button"
            onClick={() => setShowCreateMap((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
          >
            <Map className="h-4 w-4" />
            {showCreateMap ? "Hide Map" : "Pick Location on Map"}
          </button>
          {showCreateMap && (
            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden h-72">
              <CoordPickerMap
                lat={createLatNum}
                lng={createLngNum}
                onSelect={(lat, lng) => {
                  setLatitude(lat.toFixed(6))
                  setLongitude(lng.toFixed(6))
                }}
              />
            </div>
          )}
          {showCreateMap && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              Click anywhere on the map to set coordinates. Fields above auto-fill.
            </p>
          )}
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

      {/* Inline edit map (shown below table when editing) */}
      {editId && showEditMap && (
        <div className="ui-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--text)] flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[var(--brand)]" />
              Pick location on map — click to set pin
            </p>
            <button onClick={() => setShowEditMap(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden h-72">
            <CoordPickerMap
              lat={editLat ? parseFloat(editLat) : null}
              lng={editLng ? parseFloat(editLng) : null}
              onSelect={(lat, lng) => {
                setEditLat(lat.toFixed(6))
                setEditLng(lng.toFixed(6))
              }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">Click anywhere on the map. Fields in the table row auto-fill.</p>
        </div>
      )}

      <DataTable
        rows={filtered}
        columns={[
          { key: "name", header: "Office", sortable: true },
          { key: "seriesCode", header: "Series Code", sortable: true },
          {
            key: "region",
            header: "Region",
            render: (row) => <StatusChip label={row.region?.name || "—"} variant="neutral" />,
            sortable: true,
          },
          { key: "officeHead", header: "Office Head", render: (row) => row.officeHead || "—", sortable: true },
          {
            key: "coordinates",
            header: "Coordinates",
            render: (row) => {
              if (editId === row.id) {
                return (
                  <div className="space-y-1.5">
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
                      <button onClick={cancelEdit} className="text-[var(--text-muted)] hover:text-[var(--text)]" title="Cancel">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEditMap((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline"
                    >
                      <Map className="h-3 w-3" />
                      {showEditMap ? "Hide map" : "Pick on map"}
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