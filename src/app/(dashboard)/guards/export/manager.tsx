"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

export default function ExportGuardsManager() {
  const router = useRouter()
  const [parwestId, setParwestId] = useState("")
  const [name, setName] = useState("")
  const [cnic, setCnic] = useState("")
  const [status, setStatus] = useState("")
  const [exService, setExService] = useState("")
  const [supervisor, setSupervisor] = useState("")
  const [verificationStatus, setVerificationStatus] = useState("")
  const [rowsPerPage, setRowsPerPage] = useState("10")
  const [tableSearch, setTableSearch] = useState("")
  const [selectDate, setSelectDate] = useState("")
  const [notice, setNotice] = useState("")
  const [confirmAction, setConfirmAction] = useState<null | "cancel" | "reset" | "submit">(null)

  const clearFilter = () => {
    setParwestId("")
    setName("")
    setCnic("")
    setStatus("")
    setExService("")
    setSupervisor("")
    setVerificationStatus("")
    setRowsPerPage("10")
    setTableSearch("")
    setSelectDate("")
    setNotice("Filters reset.")
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Search Guard" subtitle="Legacy export screen (searchByDataTable) with export filters." />

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
          <SelectField
            label="Show 102550100200 entries"
            name="rowCountSelect"
            value={rowsPerPage}
            onChange={setRowsPerPage}
            options={["10", "25", "50", "100", "200"]}
          />
          <Field label="Search:" name="tableSearch" value={tableSearch} onChange={setTableSearch} />
          <Field label="Select Date" name="selectDate" value={selectDate} onChange={setSelectDate} type="date" />
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton variant="secondary" onClick={() => setConfirmAction("cancel")} className="inline-flex items-center gap-2">
            <X className="h-4 w-4" />
            Cancel
          </ActionButton>
          <ActionButton variant="secondary" onClick={clearFilter} className="inline-flex items-center gap-2">
            <X className="h-4 w-4" />
            Clear Filter
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => setConfirmAction("reset")} className="inline-flex items-center gap-2">
            Reset
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => setConfirmAction("submit")} className="inline-flex items-center gap-2">
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

      {confirmAction ? (
        <ConfirmDialog
          title={confirmAction === "cancel" ? "Cancel Export Guard" : confirmAction === "reset" ? "Reset Filters" : "Submit Filters"}
          message={
            confirmAction === "cancel"
              ? "Leave this screen and discard unsaved filter changes?"
              : confirmAction === "reset"
                ? "Reset all fields?"
                : "Submit current export filter set?"
          }
          onNo={() => setConfirmAction(null)}
          onYes={() => {
            if (confirmAction === "cancel") {
              router.back()
            } else if (confirmAction === "reset") {
              clearFilter()
            } else {
              setNotice("Filter set submitted.")
            }
            setConfirmAction(null)
          }}
        />
      ) : null}
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
