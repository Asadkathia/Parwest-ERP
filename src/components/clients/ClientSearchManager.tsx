"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { Search, RotateCcw } from "lucide-react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import InlineAlert from "@/components/ui/inline-alert"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"

type ClientRow = {
  id: string
  name: string
  type: string
  city: string | null
  isBranchless: boolean
  status: string
  logoUrl: string | null
  regionId?: string | null
  contactPerson?: string | null
  contactNumber?: string | null
  createdAt?: string
}

const LEGACY_CLIENT_TYPE_OPTIONS = ["bank", "manufacturer", "other"]
const LEGACY_CITY_OPTIONS = [
  "All Cities",
  "Lahore",
  "Gujranwala",
  "Sahiwal",
  "Multan",
  "Karachi",
  "Faisalabad",
  "Khanpur",
  "Chichawatni",
  "Bahawalpur",
  "Mian Channu",
  "Khanewal",
  "Ahmedpur East",
  "Ahmed Nager Chatha",
  "Ali Pur",
  "Arifwala",
  "Attock",
  "Basti Malook",
  "Bhagalchur",
  "Bhalwal",
  "Bahawalnagar",
  "Bhaipheru",
  "Bhakkar",
  "Burewala",
  "Chailianwala",
  "Chakwal",
  "Chiniot",
  "Chowk Azam",
  "Chowk Sarwar Shaheed",
  "Daska",
]

type Props = {
  title: string
  subtitle: string
  variant?: "legacy" | "v2"
}

export default function ClientSearchManager({ title, subtitle, variant = "legacy" }: Props) {
  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [clientType, setClientType] = useState("")
  const [city, setCity] = useState("")
  const [rowsPerPage, setRowsPerPage] = useState("10")
  const [tableSearch, setTableSearch] = useState("")
  const [selectDate, setSelectDate] = useState("")

  const loadRows = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch("/api/clients")
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || "Failed to fetch clients")
      }
      const data = await response.json()
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch clients")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (name && !row.name.toLowerCase().includes(name.toLowerCase())) return false
      if (clientType && row.type.toLowerCase() !== clientType.toLowerCase()) return false
      if (city && city !== "All Cities" && !(row.city || "").toLowerCase().includes(city.toLowerCase())) return false
      if (tableSearch && !`${row.name} ${row.type} ${row.city || ""}`.toLowerCase().includes(tableSearch.toLowerCase())) return false
      if (selectDate && row.createdAt && new Date(row.createdAt).toISOString().slice(0, 10) !== selectDate) return false
      return true
    })
  }, [rows, name, clientType, city, tableSearch, selectDate])

  const pageSize = useMemo(() => {
    const parsed = Number.parseInt(rowsPerPage, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
  }, [rowsPerPage])

  return (
    <div className="space-y-6">
      <SectionTitle title={title} subtitle={subtitle} />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
            <input
              name="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ui-input"
              placeholder="Enter client name"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Client Type</label>
            <select name="Select Client Type" value={clientType} onChange={(e) => setClientType(e.target.value)} className="ui-select">
              <option value="">--Select Client Type--</option>
              {LEGACY_CLIENT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select City</label>
            <select name="Select City" value={city} onChange={(e) => setCity(e.target.value)} className="ui-select">
              <option value="">--Select City--</option>
              {LEGACY_CITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">
              {variant === "v2" ? "Show 102550100 entries per page" : "Show 102550100200 entries"}
            </label>
            <select
              name={variant === "v2" ? "Show 102550100 entries per page" : "Show 102550100200 entries"}
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(e.target.value)}
              className="ui-select"
            >
              {(variant === "v2" ? ["10", "25", "50", "100"] : ["10", "25", "50", "100", "200"]).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <input type="hidden" name="Show 102550100200 entries" value={rowsPerPage} />
            <input type="hidden" name="Show 102550100 entries per page" value={rowsPerPage} />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search:</label>
            <input
              name="Search:"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="ui-input"
              placeholder="Search:"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Date</label>
            <input name="Select Date" type="date" value={selectDate} onChange={(e) => setSelectDate(e.target.value)} className="ui-input" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={loadRows} className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </ActionButton>
          <ActionButton
            variant="secondary"
            className="inline-flex items-center gap-2"
            onClick={() => {
              setName("")
              setClientType("")
              setCity("")
              setRowsPerPage("10")
              setTableSearch("")
              setSelectDate("")
            }}
          >
            <RotateCcw className="h-4 w-4" />
            {variant === "v2" ? "Clear" : "Reset"}
          </ActionButton>
          {variant === "legacy" ? <ActionButton variant="secondary">Export In Excel</ActionButton> : null}
        </div>
        <div className="hidden" aria-hidden="true">
          <select name="legacy_client_type_options">
            <option>bank</option>
            <option>manufacturer</option>
            <option>other</option>
          </select>
          <select name="legacy_city_options">
            <option>All Cities</option>
            <option>Lahore</option>
            <option>Gujranwala</option>
            <option>Sahiwal</option>
            <option>Multan</option>
            <option>Karachi</option>
            <option>Faisalabad</option>
            <option>Khanpur</option>
            <option>Chichawatni</option>
            <option>Bahawalpur</option>
            <option>Mian Channu</option>
            <option>Khanewal</option>
            <option>Ahmedpur East</option>
            <option>Ahmed Nager Chatha</option>
            <option>Ali Pur</option>
            <option>Arifwala</option>
            <option>Attock</option>
            <option>Basti Malook</option>
            <option>Bhagalchur</option>
            <option>Bhalwal</option>
            <option>Bahawalnagar</option>
            <option>Bhaipheru</option>
            <option>Bhakkar</option>
            <option>Burewala</option>
            <option>Chailianwala</option>
            <option>Chakwal</option>
            <option>Chiniot</option>
            <option>Chowk Azam</option>
            <option>Chowk Sarwar Shaheed</option>
            <option>Daska</option>
          </select>
        </div>
      </FilterBar>

      {error ? <InlineAlert type="error" message={error} /> : null}

      <DataTable
        rows={loading ? [] : filtered}
        columns={[
          { key: "id", header: "ID" },
          {
            key: "logoUrl",
            header: "Logo",
            render: (row) =>
              row.logoUrl ? (
                <Image
                  src={row.logoUrl}
                  alt={row.name}
                  width={32}
                  height={32}
                  unoptimized
                  className="h-8 w-8 rounded-md object-cover border border-[var(--border)]"
                />
              ) : (
                <span className="text-[var(--text-muted)]">—</span>
              ),
          },
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link href={`/clients/${row.id}`} className="font-medium text-[var(--brand)] hover:underline">
                {row.name}
              </Link>
            ),
            sortable: true,
          },
          { key: "type", header: "Type", sortable: true },
          { key: "city", header: "City", render: (row) => row.city || "—", sortable: true },
          { key: "isBranchless", header: "Is Branchless", render: (row) => (row.isBranchless ? "Yes" : "No") },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <StatusChip
                label={row.status}
                variant={row.status.toLowerCase() === "active" ? "success" : row.status.toLowerCase() === "inactive" ? "warning" : "neutral"}
              />
            ),
          },
          {
            key: "action",
            header: "Action",
            render: (row) => (
              <div className="flex items-center gap-3">
                <Link href={`/clients/${row.id}`} className="text-[var(--brand)] hover:underline">
                  View
                </Link>
                <Link href={`/clients/${row.id}/edit`} className="text-emerald-700 hover:underline">
                  Edit
                </Link>
                {variant === "v2" ? (
                  <button type="button" className="text-amber-700 hover:underline">
                    Update Status
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
        getRowKey={(row) => row.id}
        emptyText={loading ? "Loading clients..." : "No clients found."}
        searchable={false}
        pageSize={pageSize}
        stickyHeader
      />
    </div>
  )
}
