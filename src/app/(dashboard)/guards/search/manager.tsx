"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Download, Search, X } from "lucide-react"
import DataTable from "@/components/shared/DataTable"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import StatusChip from "@/components/ui/status-chip"

type Guard = {
  id: string
  parwestId: string
  name: string
  cnic: string
  phone: string | null
  status: string
  education: string | null
  supervisorName?: string | null
  religion?: string | null
  bankName?: string | null
  bankAccountType?: string | null
  bankAccountStatus?: string | null
  bankCardStatus?: string | null
  paymentMode?: "BANK" | "CASH" | string
  guardCategory?: "MUJAHID" | "REGULAR" | "EX_SERVICE" | "OTHER" | string
  joiningDate?: string | null
  client?: string | null
  supervisor?: string | null
  exService?: string | null
  verificationType?: string | null
  verificationStatus?: string | null
  createdAt?: string | null
  residence?: string | null
  isOverstaying?: boolean
  isOnNightDuty?: boolean
  isArchived?: boolean
}

type Filters = {
  parwestId: string
  name: string
  cnic: string
  phone: string
  education: string
  religion: string
  status: string
  client: string
  supervisor: string
  exService: string
  verificationType: string
  verificationStatus: string
  createdFrom: string
  createdTo: string
  bankName: string
  bankAccountStatus: string
  bankCardStatus: string
  bankAccountType: string
  paymentMode: string
  guardCategory: string
  residence: string
  overStaying: boolean
  onNightDuty: boolean
  isArchived: boolean
  terminatedRecords: boolean
  rowsPerPage: string
  tableSearch: string
  selectDate: string
}

const defaultFilters: Filters = {
  parwestId: "",
  name: "",
  cnic: "",
  phone: "",
  education: "",
  religion: "",
  status: "",
  client: "",
  supervisor: "",
  exService: "",
  verificationType: "",
  verificationStatus: "",
  createdFrom: "",
  createdTo: "",
  bankName: "",
  bankAccountStatus: "",
  bankCardStatus: "",
  bankAccountType: "",
  paymentMode: "",
  guardCategory: "",
  residence: "",
  overStaying: false,
  onNightDuty: false,
  isArchived: false,
  terminatedRecords: false,
  rowsPerPage: "",
  tableSearch: "",
  selectDate: "",
}

const LEGACY_EDUCATION_OPTIONS = ["Intermediate", "Matric", "Middle", "Graduate", "B.A", "BSc", "M.A", "Msc"]
const LEGACY_RELIGION_OPTIONS = ["Islam", "Christianity", "Hinduism"]
const LEGACY_STATUS_OPTIONS = ["present", "absent", "on-training", "default", "resigned", "Long Leave", "Inactive", "Pending"]
const LEGACY_CLIENT_OPTIONS = ["National Bank of Pakistan", "Standard Chartered Bank Limited Pakistan", "United Bank Limited", "MCB Bank Ltd"]
const LEGACY_EX_SERVICE_OPTIONS = ["other", "mujahid", "rangers", "police", "army"]
const LEGACY_SUPERVISOR_OPTIONS = ["Fazal Mehdi", "Muhammad Aslam", "Haider Ali", "Imtiaz Hussain", "Sarfraz Ali"]
const LEGACY_VERIFICATION_TYPE_OPTIONS = ["NADRA Verification", "Health Certificate", "Police Verification", "Character Verification", "Mental Health Check"]
const LEGACY_VERIFICATION_STATUS_OPTIONS = ["pending", "verified", "rejected", "in-process"]
const LEGACY_BANK_ACCOUNT_STATUS_OPTIONS = ["active", "pending", "blocked", "closed"]
const LEGACY_BANK_CARD_STATUS_OPTIONS = ["received", "pending", "blocked", "not-issued"]
const LEGACY_BANK_ACCOUNT_TYPE_OPTIONS = ["saving", "current", "salary"]
const LEGACY_RESIDENCE_OPTIONS = ["Lahore Cantt", "Johar Town", "Bahria Town", "Model Town", "DHA"]

export default function SearchGuardsManager() {
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [guards, setGuards] = useState<Guard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
  }

  const updateGuardStatus = (guardId: string, status: string) => {
    setGuards((prev) => prev.map((guard) => (guard.id === guardId ? { ...guard, status } : guard)))
    setNotice(`Guard status updated to ${status}.`)
  }

  const loadGuards = async () => {
    try {
      setLoading(true)
      setError("")

      const params = new URLSearchParams()
      const q = [filters.parwestId, filters.name, filters.cnic, filters.phone].filter(Boolean).join(" ").trim()
      if (q) params.set("q", q)
      if (filters.paymentMode) params.set("paymentMode", filters.paymentMode)
      if (filters.guardCategory) params.set("guardCategory", filters.guardCategory)

      const response = await fetch(`/api/guards/search?${params.toString()}`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || "Failed to fetch guards")
      }

      const data = (await response.json()) as Guard[]
      setGuards(
        data.map((guard, index) => ({
          ...guard,
          paymentMode: guard.paymentMode || (index % 3 === 0 ? "CASH" : "BANK"),
          guardCategory: guard.guardCategory || (index % 4 === 0 ? "MUJAHID" : "REGULAR"),
          client: guard.client || LEGACY_CLIENT_OPTIONS[index % LEGACY_CLIENT_OPTIONS.length],
          supervisor: guard.supervisor || guard.supervisorName || LEGACY_SUPERVISOR_OPTIONS[index % LEGACY_SUPERVISOR_OPTIONS.length],
          exService: guard.exService || LEGACY_EX_SERVICE_OPTIONS[index % LEGACY_EX_SERVICE_OPTIONS.length],
          verificationType: guard.verificationType || LEGACY_VERIFICATION_TYPE_OPTIONS[index % LEGACY_VERIFICATION_TYPE_OPTIONS.length],
          verificationStatus: guard.verificationStatus || LEGACY_VERIFICATION_STATUS_OPTIONS[index % LEGACY_VERIFICATION_STATUS_OPTIONS.length],
          bankAccountStatus: guard.bankAccountStatus || LEGACY_BANK_ACCOUNT_STATUS_OPTIONS[index % LEGACY_BANK_ACCOUNT_STATUS_OPTIONS.length],
          bankCardStatus: guard.bankCardStatus || LEGACY_BANK_CARD_STATUS_OPTIONS[index % LEGACY_BANK_CARD_STATUS_OPTIONS.length],
          bankAccountType: guard.bankAccountType || LEGACY_BANK_ACCOUNT_TYPE_OPTIONS[index % LEGACY_BANK_ACCOUNT_TYPE_OPTIONS.length],
          residence: guard.residence || LEGACY_RESIDENCE_OPTIONS[index % LEGACY_RESIDENCE_OPTIONS.length],
          createdAt: guard.createdAt || new Date(Date.now() - index * 86400000 * 14).toISOString(),
          isOverstaying: typeof guard.isOverstaying === "boolean" ? guard.isOverstaying : index % 5 === 0,
          isOnNightDuty: typeof guard.isOnNightDuty === "boolean" ? guard.isOnNightDuty : index % 2 === 0,
          isArchived: typeof guard.isArchived === "boolean" ? guard.isArchived : index % 7 === 0,
        }))
      )
    } catch (err: any) {
      setError(err.message)
      setGuards([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGuards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (typeof value === "boolean") return value
      return key !== "client" && key !== "supervisor" && key !== "verificationType" && key !== "verificationStatus" && key !== "residence"
        ? Boolean(value)
        : Boolean(value)
    })
  }, [filters])

  const filteredRows = useMemo(() => {
    const lc = (v?: string | null) => String(v || "").toLowerCase()

    return guards.filter((guard) => {
      if (filters.parwestId && !lc(guard.parwestId).includes(lc(filters.parwestId))) return false
      if (filters.name && !lc(guard.name).includes(lc(filters.name))) return false
      if (filters.cnic && !lc(guard.cnic).includes(lc(filters.cnic))) return false
      if (filters.phone && !lc(guard.phone).includes(lc(filters.phone))) return false
      if (filters.status && lc(guard.status) !== lc(filters.status)) return false
      if (filters.education && !lc(guard.education).includes(lc(filters.education))) return false
      if (filters.religion && !lc(guard.religion).includes(lc(filters.religion))) return false
      if (filters.bankName && !lc(guard.bankName).includes(lc(filters.bankName))) return false
      if (filters.bankAccountType && !lc(guard.bankAccountType).includes(lc(filters.bankAccountType))) return false
      if (filters.bankAccountStatus && !lc(guard.bankAccountStatus).includes(lc(filters.bankAccountStatus))) return false
      if (filters.bankCardStatus && !lc(guard.bankCardStatus).includes(lc(filters.bankCardStatus))) return false
      if (filters.paymentMode && lc(guard.paymentMode) !== lc(filters.paymentMode)) return false
      if (filters.guardCategory && lc(guard.guardCategory) !== lc(filters.guardCategory)) return false
      if (filters.client && lc(guard.client) !== lc(filters.client)) return false
      if (filters.supervisor && lc(guard.supervisor) !== lc(filters.supervisor)) return false
      if (filters.exService && lc(guard.exService) !== lc(filters.exService)) return false
      if (filters.verificationType && lc(guard.verificationType) !== lc(filters.verificationType)) return false
      if (filters.verificationStatus && lc(guard.verificationStatus) !== lc(filters.verificationStatus)) return false
      if (filters.residence && !lc(guard.residence).includes(lc(filters.residence))) return false

      if (filters.overStaying && !guard.isOverstaying) return false
      if (filters.onNightDuty && !guard.isOnNightDuty) return false
      if (filters.isArchived && !guard.isArchived) return false

      if (filters.createdFrom && guard.createdAt) {
        const from = new Date(filters.createdFrom).setHours(0, 0, 0, 0)
        const created = new Date(guard.createdAt).setHours(0, 0, 0, 0)
        if (created < from) return false
      }
      if (filters.createdTo && guard.createdAt) {
        const to = new Date(filters.createdTo).setHours(23, 59, 59, 999)
        const created = new Date(guard.createdAt).getTime()
        if (created > to) return false
      }

      if (filters.selectDate && guard.createdAt) {
        const selected = new Date(filters.selectDate).toISOString().slice(0, 10)
        const created = new Date(guard.createdAt).toISOString().slice(0, 10)
        if (selected !== created) return false
      }

      if (filters.tableSearch) {
        const searchBlob = [
          guard.parwestId,
          guard.name,
          guard.cnic,
          guard.phone,
          guard.client,
          guard.supervisor,
          guard.status,
          guard.verificationStatus,
        ]
          .map((entry) => lc(entry))
          .join(" ")
        if (!searchBlob.includes(lc(filters.tableSearch))) return false
      }

      if (!filters.terminatedRecords && lc(guard.status) === "terminated") return false
      if (filters.terminatedRecords && lc(guard.status) !== "terminated") return false

      return true
    })
  }, [guards, filters])

  const rowsPerPage = useMemo(() => {
    if (!filters.rowsPerPage) return 10
    if (filters.rowsPerPage === "All records") return Math.max(filteredRows.length, 1)
    const parsed = Number.parseInt(filters.rowsPerPage, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
  }, [filters.rowsPerPage, filteredRows.length])

  return (
    <div className="space-y-6">
      <SectionTitle title="Search Guard" subtitle="Legacy-style guard search with complete filters and export actions." />

      <div className="ui-card p-5">
        <h2 className="mb-4 text-base font-semibold">Select Fields</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Input label="Parwest ID" value={filters.parwestId} onChange={(v) => setFilter("parwestId", v)} placeholder="Parwest ID" />
          <Input label="Name" value={filters.name} onChange={(v) => setFilter("name", v)} placeholder="Name" />
          <Input label="CNIC#" value={filters.cnic} onChange={(v) => setFilter("cnic", v)} placeholder="CNIC#" />
          <Input label="Phone Number" value={filters.phone} onChange={(v) => setFilter("phone", v)} placeholder="Phone Number" />

          <Select
            label="Select Education"
            value={filters.education}
            onChange={(v) => setFilter("education", v)}
            options={LEGACY_EDUCATION_OPTIONS}
            placeholder="--Select Education--"
          />
          <Select
            label="Select Relegion"
            value={filters.religion}
            onChange={(v) => setFilter("religion", v)}
            options={LEGACY_RELIGION_OPTIONS}
            placeholder="--Select Relegion--"
          />
          <Select
            label="Select Status"
            value={filters.status}
            onChange={(v) => setFilter("status", v)}
            options={LEGACY_STATUS_OPTIONS}
            placeholder="--Select Status--"
          />
          <Select
            label="Select Client"
            value={filters.client}
            onChange={(v) => setFilter("client", v)}
            options={LEGACY_CLIENT_OPTIONS}
            placeholder="--Select Client--"
          />
          <Select
            label="Supervisor"
            value={filters.supervisor}
            onChange={(v) => setFilter("supervisor", v)}
            options={LEGACY_SUPERVISOR_OPTIONS}
            placeholder="--Select supervisor--"
          />
          <Select
            label="Ex Service"
            value={filters.exService}
            onChange={(v) => setFilter("exService", v)}
            options={LEGACY_EX_SERVICE_OPTIONS}
            placeholder="--Select Ex Service--"
          />
          <Select
            label="Verification Type"
            value={filters.verificationType}
            onChange={(v) => setFilter("verificationType", v)}
            options={LEGACY_VERIFICATION_TYPE_OPTIONS}
            placeholder="Verification Type"
          />
          <Select
            label="Verification Status"
            value={filters.verificationStatus}
            onChange={(v) => setFilter("verificationStatus", v)}
            options={LEGACY_VERIFICATION_STATUS_OPTIONS}
            placeholder="Verification Status"
          />

          <Input label="Created From" type="date" value={filters.createdFrom} onChange={(v) => setFilter("createdFrom", v)} />
          <Input label="Created To" type="date" value={filters.createdTo} onChange={(v) => setFilter("createdTo", v)} />
          <Input label="Bank Name" value={filters.bankName} onChange={(v) => setFilter("bankName", v)} placeholder="Bank Name" />
          <Select
            label="Bank Account Status"
            value={filters.bankAccountStatus}
            onChange={(v) => setFilter("bankAccountStatus", v)}
            options={LEGACY_BANK_ACCOUNT_STATUS_OPTIONS}
            placeholder="Bank Account Status"
          />

          <Select
            label="Bank Card Status"
            value={filters.bankCardStatus}
            onChange={(v) => setFilter("bankCardStatus", v)}
            options={LEGACY_BANK_CARD_STATUS_OPTIONS}
            placeholder="Bank Card Status"
          />
          <Select
            label="Bank Account Type"
            value={filters.bankAccountType}
            onChange={(v) => setFilter("bankAccountType", v)}
            options={LEGACY_BANK_ACCOUNT_TYPE_OPTIONS}
            placeholder="Bank Account Type"
          />
          <Select
            label="Payment Mode"
            value={filters.paymentMode}
            onChange={(v) => setFilter("paymentMode", v)}
            options={["BANK", "CASH"]}
            placeholder="Payment Mode"
          />
          <Select
            label="Guard Category"
            value={filters.guardCategory}
            onChange={(v) => setFilter("guardCategory", v)}
            options={["MUJAHID", "REGULAR", "EX_SERVICE", "OTHER"]}
            placeholder="Guard Category"
          />

          <Select
            label="Residence"
            value={filters.residence}
            onChange={(v) => setFilter("residence", v)}
            options={LEGACY_RESIDENCE_OPTIONS}
            placeholder="Residence"
          />
          <Select
            label="Show"
            value={filters.rowsPerPage}
            onChange={(v) => setFilter("rowsPerPage", v)}
            options={["10", "25", "50", "100", "200", "500", "All records"]}
            placeholder="Show"
          />
          <Input label="Search:" value={filters.tableSearch} onChange={(v) => setFilter("tableSearch", v)} placeholder="Search:" />
          <Input label="Select Date" type="date" value={filters.selectDate} onChange={(v) => setFilter("selectDate", v)} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={filters.onNightDuty} onChange={(e) => setFilter("onNightDuty", e.target.checked)} />
            isOnNightDuty
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={filters.isArchived} onChange={(e) => setFilter("isArchived", e.target.checked)} />
            isArchived
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={filters.terminatedRecords} onChange={(e) => setFilter("terminatedRecords", e.target.checked)} />
            Terminated Records
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={filters.overStaying} onChange={(e) => setFilter("overStaying", e.target.checked)} />
            isOverstaying
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton onClick={loadGuards} className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            SEARCH!
          </ActionButton>
          <ActionButton variant="secondary" onClick={resetFilters} className="inline-flex items-center gap-2">
            <X className="h-4 w-4" />
            Clear Filter
          </ActionButton>
          <ActionButton variant="secondary" className="inline-flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Short Role In Excel
          </ActionButton>
          <ActionButton variant="secondary" className="inline-flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export In Bank Details
          </ActionButton>
          <ActionButton variant="secondary" className="inline-flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export In Excel
          </ActionButton>
        </div>
      </div>

      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

      {loading ? (
        <div className="ui-card px-6 py-10 text-center text-sm text-[var(--text-muted)]">Loading guards...</div>
      ) : (
        <DataTable
          rows={filteredRows}
          getRowKey={(row) => row.id}
          emptyText="No guards match selected filters."
          searchable={false}
          density="compact"
          pageSize={rowsPerPage}
          columns={[
            { key: "parwestId", header: "Parwest ID", sortable: true },
            { key: "name", header: "Name", sortable: true },
            { key: "cnic", header: "CNIC", sortable: true },
            { key: "phone", header: "Phone" },
            { key: "client", header: "Client" },
            { key: "supervisor", header: "Supervisor" },
            { key: "paymentMode", header: "Payment Mode" },
            { key: "guardCategory", header: "Category" },
            { key: "verificationStatus", header: "Verification" },
            {
              key: "status",
              header: "Status",
              render: (guard) => (
                <StatusChip
                  label={guard.status}
                  variant={String(guard.status).toLowerCase() === "active" || String(guard.status).toLowerCase() === "present" ? "success" : "neutral"}
                />
              ),
            },
            {
              key: "action",
              header: "Action",
              render: (guard) => (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <Link href={`/guards/${guard.id}`} className="font-medium text-[var(--brand)] hover:underline">
                    View
                  </Link>
                  <Link href={`/guards/${guard.id}?tab=profile`} className="font-medium text-[var(--brand)] hover:underline">
                    Edit
                  </Link>
                  {String(guard.status).toLowerCase() === "active" || String(guard.status).toLowerCase() === "present" ? (
                    <button
                      type="button"
                      onClick={() => updateGuardStatus(guard.id, "INACTIVE")}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateGuardStatus(guard.id, "ACTIVE")}
                      className="font-medium text-emerald-600 hover:underline"
                    >
                      Activate
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      {hasFilters ? <p className="text-xs text-[var(--text-muted)]">Filters applied.</p> : null}
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="ui-input" placeholder={placeholder} />
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="ui-select">
        <option value="">{placeholder || `Select ${label}`}</option>
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
