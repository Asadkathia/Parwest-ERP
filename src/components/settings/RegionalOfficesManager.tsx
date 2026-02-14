"use client"

import { useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"

type Office = {
  id: string
  office: string
  seriesCode: string
  region: string
  officeHead: string
  phone?: string
  mobile?: string
  fax?: string
}

const initialRows: Office[] = [
  { id: "1", office: "Lahore Head Office", seriesCode: "L", region: "Lahore", officeHead: "Admin", phone: "042-111", mobile: "0300-0000000", fax: "042-000" },
  { id: "2", office: "Karachi Office", seriesCode: "K", region: "Sindh", officeHead: "Manager KHI", phone: "021-111", mobile: "0301-0000000", fax: "021-000" },
]

export default function RegionalOfficesManager() {
  const [rows, setRows] = useState<Office[]>(initialRows)
  const [office, setOffice] = useState("")
  const [officeHead, setOfficeHead] = useState("")
  const [seriesCode, setSeriesCode] = useState("")
  const [phone, setPhone] = useState("")
  const [mobile, setMobile] = useState("")
  const [fax, setFax] = useState("")
  const [region, setRegion] = useState("")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search) return rows
    return rows.filter((row) =>
      [row.office, row.seriesCode, row.region, row.officeHead].join(" ").toLowerCase().includes(search.toLowerCase())
    )
  }, [rows, search])

  const onCreate = () => {
    if (!office.trim() || !seriesCode.trim() || !region.trim()) return

    setRows((prev) => [
      {
        id: String(prev.length + 1),
        office: office.trim(),
        officeHead: officeHead.trim() || "—",
        seriesCode: seriesCode.trim().toUpperCase(),
        phone: phone.trim() || undefined,
        mobile: mobile.trim() || undefined,
        fax: fax.trim() || undefined,
        region: region.trim(),
      },
      ...prev,
    ])

    setOffice("")
    setOfficeHead("")
    setSeriesCode("")
    setPhone("")
    setMobile("")
    setFax("")
    setRegion("")
  }

  const onDelete = (id: string) => setRows((prev) => prev.filter((row) => row.id !== id))

  return (
    <div className="space-y-6">
      <SectionTitle title="Settings: Regional Offices" subtitle="Manage specific offices within regions." />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Office Name *</label>
            <input value={office} onChange={(e) => setOffice(e.target.value)} className="ui-input" placeholder="Office name" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Office Head</label>
            <input value={officeHead} onChange={(e) => setOfficeHead(e.target.value)} className="ui-input" placeholder="Office head" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Series Code *</label>
            <input value={seriesCode} onChange={(e) => setSeriesCode(e.target.value)} className="ui-input" placeholder="LHR" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="ui-input" placeholder="Phone" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Mobile</label>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="ui-input" placeholder="Mobile" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Fax</label>
            <input value={fax} onChange={(e) => setFax(e.target.value)} className="ui-input" placeholder="Fax" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Region *</label>
            <input value={region} onChange={(e) => setRegion(e.target.value)} className="ui-input" placeholder="Region" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input" placeholder="Search" />
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={onCreate}>Create</ActionButton>
          <ActionButton variant="secondary">Update</ActionButton>
          <ActionButton variant="danger">Delete</ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={filtered}
        columns={[
          { key: "office", header: "Office", sortable: true },
          { key: "seriesCode", header: "Series Code", sortable: true },
          { key: "region", header: "Region", render: (row) => <StatusChip label={row.region} variant="neutral" />, sortable: true },
          { key: "officeHead", header: "Office Head", sortable: true },
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
        stickyHeader
        emptyText="No offices found."
      />
    </div>
  )
}
