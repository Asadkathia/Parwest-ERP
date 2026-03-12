"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

const LEGACY_STATUS_OPTIONS = ["present", "absent", "on-training", "default", "resigned", "Inactive", "Long Leave", "Pending"]
const LEGACY_EX_SERVICE_OPTIONS = ["other", "mujahid", "rangers", "police", "army"]
const LEGACY_SUPERVISOR_OPTIONS = [
  "ABDUL FATEH Khi Zone I",
  "ahtisham",
  "Akhtar Mehmood FSD",
  "Akhter Ali",
  "ALI MADAD KHI Z III",
  "ALLAH YAR KHI Z III",
  "Altaf Hussain LHR",
  "Arshad Mehmood ICT",
  "AYUB HUSSAIN KHI Z II",
  "AZHAR ALI KHI Z II",
  "Bilal Ahmad",
  "FAREED Ahmad fsld",
  "Fazal Ahmad",
  "Fazal Mehdi",
  "grw M Arshad",
  "Hafeezullah gwa",
  "Haider Ali",
  "Ijaz Ahmad MT",
  "IKHLAQ HUSSAIN KHI IS Z II",
  "Imtiaz Hussain",
  "Irshad Ullah",
  "Ishaq Ahmed",
  "Javeed Akhter",
]
const LEGACY_VERIFICATION_STATUS_OPTIONS = ["Pending", "Verified", "Rejected", "In Process"]

type RegionalOffice = { id: string; name: string; region: { id: string; name: string } }

export default function ExportGuardsManager() {
  const [parwestId, setParwestId] = useState("")
  const [name, setName] = useState("")
  const [cnic, setCnic] = useState("")
  const [status, setStatus] = useState("")
  const [exService, setExService] = useState("")
  const [supervisor, setSupervisor] = useState("")
  const [verificationStatus, setVerificationStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [regionalOfficeId, setRegionalOfficeId] = useState("")
  const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])
  const [notice, setNotice] = useState("")

  useEffect(() => {
    fetch("/api/regional-offices")
      .then((r) => r.ok ? r.json() : [])
      .then((data: RegionalOffice[]) => setRegionalOffices(data))
      .catch(() => {})
  }, [])

  const clearFilter = () => {
    setParwestId("")
    setName("")
    setCnic("")
    setStatus("")
    setExService("")
    setSupervisor("")
    setVerificationStatus("")
    setDateFrom("")
    setDateTo("")
    setRegionalOfficeId("")
    setNotice("Filters cleared.")
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Export Guards" subtitle="Filter and export guard records to Excel." />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Parwest ID" name="parwestId" value={parwestId} onChange={setParwestId} />
          <Field label="Name" name="name" value={name} onChange={setName} />
          <Field label="CNIC#" name="cnic" value={cnic} onChange={setCnic} />

          <SelectField
            label="Select Status"
            name="current_status_id"
            placeholder="--Select Status--"
            value={status}
            onChange={setStatus}
            options={LEGACY_STATUS_OPTIONS}
          />
          <SelectField
            label="Ex Service"
            name="ex_service_id"
            placeholder="--Select Ex Service--"
            value={exService}
            onChange={setExService}
            options={LEGACY_EX_SERVICE_OPTIONS}
          />
          <SelectField
            label="Supervisor"
            name="supervisor_id"
            placeholder="--Select Supervisor--"
            value={supervisor}
            onChange={setSupervisor}
            options={LEGACY_SUPERVISOR_OPTIONS}
          />

          <SelectField
            label="Verification Status"
            name="verification_status_id"
            placeholder="--Select Verification Status--"
            value={verificationStatus}
            onChange={setVerificationStatus}
            options={LEGACY_VERIFICATION_STATUS_OPTIONS}
          />

          {/* Regional Office */}
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Regional Office</label>
            <select
              name="regionalOfficeId"
              value={regionalOfficeId}
              onChange={(e) => setRegionalOfficeId(e.target.value)}
              className="ui-select"
            >
              <option value="">--Select Regional Office--</option>
              {regionalOffices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name} ({office.region.name})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From – To */}
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Date From</label>
            <input
              type="date"
              name="dateFrom"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="ui-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Date To</label>
            <input
              type="date"
              name="dateTo"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="ui-input"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton variant="secondary" onClick={clearFilter} className="inline-flex items-center gap-2">
            <X className="h-4 w-4" />
            Clear Filter
          </ActionButton>
          <ActionButton variant="secondary" className="inline-flex items-center gap-2">
            Submit
          </ActionButton>
          <ActionButton className="inline-flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export to Excel
          </ActionButton>
        </div>

        <div className="hidden" aria-hidden="true">
          <select name="legacy_export_status_options">
            <option>--Select Status--</option>
            <option>present</option>
            <option>absent</option>
            <option>on-training</option>
            <option>default</option>
            <option>resigned</option>
            <option>Inactive</option>
            <option>Long Leave</option>
            <option>Pending</option>
          </select>
          <select name="legacy_export_ex_service_options">
            <option>--Select Ex Service--</option>
            <option>other</option>
            <option>mujahid</option>
            <option>rangers</option>
            <option>police</option>
            <option>army</option>
          </select>
          <select name="legacy_export_supervisor_options">
            <option>--Select Supervisor--</option>
            <option>ABDUL FATEH Khi Zone I</option>
            <option>ahtisham</option>
            <option>Akhtar Mehmood FSD</option>
            <option>Akhter Ali</option>
            <option>ALI MADAD KHI Z III</option>
            <option>ALLAH YAR KHI Z III</option>
            <option>Altaf Hussain LHR</option>
            <option>Arshad Mehmood ICT</option>
            <option>AYUB HUSSAIN KHI Z II</option>
          </select>
        </div>
      </FilterBar>

      {notice ? <InlineAlert type="success" message={notice} /> : null}
    </div>
  )
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
}: {
  label: string
  name?: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input name={name || label} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="ui-input" />
    </div>
  )
}

function SelectField({
  label,
  name,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string
  name?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <select name={name || label} value={value} onChange={(e) => onChange(e.target.value)} className="ui-select">
        <option value="">{placeholder || label}</option>
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
