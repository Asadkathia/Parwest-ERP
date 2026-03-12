"use client"

import { type ReactNode, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"
import GuardAccountsEditor from "@/components/guards/GuardAccountsEditor"

type RegionalOffice = {
  id: string
  name: string
  region: {
    id: string
    name: string
  }
}

type Props = {
  regionalOffices: RegionalOffice[]
  currentUserName: string
}

type SectionConfig = {
  id: string
  label: string
}

const SECTION_CONFIG: SectionConfig[] = [
  { id: "general", label: "GENERAL INFORMATION" },
  { id: "bankAccount", label: "GUARD BANK ACCOUNT DETAILS" },
  { id: "previousEmployment", label: "PREVIOUS EMPLOYMENT DETAILS" },
  { id: "address", label: "ADDRESS DETAIL" },
  { id: "education", label: "EDUCATION" },
  { id: "introducer", label: "INTRODUCER" },
  { id: "physical", label: "PHYSICAL DETAILS" },
  { id: "family", label: "ADD FAMILY MEMBER DETAIL" },
  { id: "nearestRelative", label: "ADD NEAREST RELATIVE DETAIL" },
]

const LEGACY_GUARD_TYPES = [
  "Guard",
  "location supervisor",
  "cpo",
  "SO",
  "ASO",
  "LSO",
  "Receptionist",
  "CCTV Operator",
  "Complaint Receiver",
]

const EDUCATION_LEVELS = ["Primary", "Middle", "Matric", "Intermediate", "Graduate", "B.A", "BSc", "M.A", "Msc"]
const BLOOD_GROUPS = ["O+ve", "A+ve", "B+ve", "AB+ve", "O-ve", "A-ve", "B-ve", "AB-ve"]
const MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "separated", "engaged"]
const PREREQUISITE_ITEMS = [
  "NADRA Verification",
  "Health Certificate Verification",
  "Police Verification",
  "Eyesight Certificate",
  "character verification",
  "mental health check",
  "3rd gurantor verysis",
  "Company card & CNIC",
]

function useSectionChecklist() {
  const initial = Object.fromEntries(SECTION_CONFIG.map((s) => [s.id, true])) as Record<string, boolean>

  const [sections, setSections] = useState<Record<string, boolean>>(initial)
  const allSelected = useMemo(() => Object.values(sections).every(Boolean), [sections])

  const toggle = (id: string) => setSections((prev) => ({ ...prev, [id]: !prev[id] }))
  const setAll = (value: boolean) => {
    setSections(Object.fromEntries(SECTION_CONFIG.map((s) => [s.id, value])) as Record<string, boolean>)
  }

  return { sections, toggle, allSelected, setAll }
}

function calculateAge(dateOfBirth: string, referenceDate?: string) {
  if (!dateOfBirth) return ""

  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return ""

  const reference = referenceDate ? new Date(referenceDate) : new Date()
  if (Number.isNaN(reference.getTime())) return ""

  let age = reference.getFullYear() - birth.getFullYear()
  const monthDiff = reference.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birth.getDate())) {
    age--
  }
  return age >= 0 ? String(age) : ""
}

export default function GuardEnrollmentForm({ regionalOffices, currentUserName }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const { sections, toggle, allSelected, setAll } = useSectionChecklist()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => Object.fromEntries(SECTION_CONFIG.map((s) => [s.id, false])) as Record<string, boolean>
  )
  const [prerequisites, setPrerequisites] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        PREREQUISITE_ITEMS.map((item) => [item.toLowerCase().replace(/[^a-z0-9]+/g, "_"), false])
      ) as Record<string, boolean>
  )

  const [familyRows, setFamilyRows] = useState([0])
  const [nearestRows, setNearestRows] = useState([0])
  const familyCounterRef = useRef(1)
  const nearestCounterRef = useRef(1)
  const [contactRows, setContactRows] = useState([1])
  const contactCounterRef = useRef(2)
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [joiningDate, setJoiningDate] = useState("")
  const [maritalStatus, setMaritalStatus] = useState("")
  const [exServiceType, setExServiceType] = useState("ARMY")
  const ageValue = useMemo(() => calculateAge(dateOfBirth), [dateOfBirth])
  const joiningAgeValue = useMemo(() => calculateAge(dateOfBirth, joiningDate), [dateOfBirth, joiningDate])

  const toggleSectionCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleChecklistSection = (id: string) => {
    toggle(id)
    setCollapsed((prev) => ({ ...prev, [id]: false }))
  }

  const allPrerequisitesSelected = useMemo(
    () => Object.values(prerequisites).length > 0 && Object.values(prerequisites).every(Boolean),
    [prerequisites]
  )

  const togglePrerequisite = (key: string) => {
    setPrerequisites((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleAllPrerequisites = (value: boolean) => {
    setPrerequisites((prev) =>
      Object.fromEntries(Object.keys(prev).map((key) => [key, value])) as Record<string, boolean>
    )
  }

  const applyOcrFields = (fields: Record<string, string>) => {
    const form = formRef.current
    if (!form) return

    Object.entries(fields).forEach(([name, value]) => {
      const input = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null
      if (input) input.value = value
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>
    const cnicValue = String(data.cnic || "").trim()
    const ageValue = String(data.age || "").trim()
    const contactNumbers = Object.entries(data)
      .filter(([key]) => key === "phone" || key.startsWith("phone_secondary_"))
      .map(([, value]) => String(value || "").trim())
      .filter(Boolean)
    const familyAgeValues = Object.entries(data)
      .filter(([key]) => key.includes("_age"))
      .map(([, value]) => String(value || "").trim())

    if (cnicValue && !/^\d{5}-\d{7}-\d$/.test(cnicValue)) {
      setError("CNIC format must be XXXXX-XXXXXXX-X")
      setLoading(false)
      return
    }

    if (contactNumbers.length === 0) {
      setError("At least one contact number is required.")
      setLoading(false)
      return
    }

    for (const number of contactNumbers) {
      if (!/^\+92-\d{3}-\d{7}$/.test(number)) {
        setError("Contact format must be +92-300-1234567")
        setLoading(false)
        return
      }
    }

    if (ageValue && (!Number.isFinite(Number(ageValue)) || Number(ageValue) < 0)) {
      setError("Please enter a valid age")
      setLoading(false)
      return
    }

    for (const familyAge of familyAgeValues) {
      if (familyAge && (!Number.isFinite(Number(familyAge)) || Number(familyAge) < 0)) {
        setError("Please enter a valid age")
        setLoading(false)
        return
      }
    }

    try {
      data.phone = contactNumbers[0]
      data.additionalContactNumbers = contactNumbers.slice(1).join(", ")

      const response = await fetch("/api/guards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const responseError = await response.json().catch(() => ({}))
        throw new Error(responseError.message || "Failed to create guard")
      }

      setSuccess("Guard created successfully.")
      router.push("/guards")
      router.refresh()
    } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
      setLoading(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="ui-card p-6">
        <h2 className="mb-3 text-lg font-semibold text-[var(--text)]">Pre-Requisites Checklist</h2>
        <label className="mb-3 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <input
            type="checkbox"
            name="select_all_prerequisites"
            checked={allPrerequisitesSelected}
            onChange={(e) => toggleAllPrerequisites(e.target.checked)}
          />
          <span className="text-sm font-medium">Select All</span>
        </label>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {PREREQUISITE_ITEMS.map((item) => {
            const key = item.toLowerCase().replace(/[^a-z0-9]+/g, "_")
            return (
            <label key={item} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
              <input
                type="checkbox"
                name={`pre_${key}`}
                value="true"
                checked={prerequisites[key] || false}
                onChange={() => togglePrerequisite(key)}
              />
              <span className="text-sm">{item}</span>
            </label>
          )})}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setAll(!allSelected)} className="ui-btn ui-btn-secondary">
            {allSelected ? "Uncheck All" : "Select All"}
          </button>
          <input className="ui-input max-w-xs" name="importCnic" placeholder="Cnic #" />
          <button type="button" className="ui-btn ui-btn-primary">IMPORT</button>
        </div>
      </div>

      <div className="ui-card p-6">
        <OcrUploadPanel target="guard" onApply={applyOcrFields} />
      </div>

      <div className="grid grid-cols-1 gap-2">
        {SECTION_CONFIG.map((section) => (
          <label key={section.id} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2">
            <input type="checkbox" checked={sections[section.id]} onChange={() => toggleChecklistSection(section.id)} className="h-4 w-4 accent-[var(--brand)]" />
            <span className={sections[section.id] ? "text-sm text-[var(--text)] line-through" : "text-sm text-[var(--text)]"}>{section.label}</span>
          </label>
        ))}
      </div>

      {sections.general ? (
        <CollapsibleSection
          title="GENERAL INFORMATION"
          collapsed={collapsed.general}
          onToggle={() => toggleSectionCollapse("general")}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Regional Office <span className="text-red-500">*</span>
              </label>
              <select name="regionalOfficeId" required className="ui-input">
                <option value="">Select regional office</option>
                <option value="legacy-head-office-lahore">head office lahore</option>
                {regionalOffices.map((office) => (
                  <option key={`regionalOffice-${office.id}`} value={office.id}>
                    {office.name} ({office.region.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Parwest ID</label>
              <input
                type="text"
                value="Auto-generated on submit"
                readOnly
                className="ui-input bg-slate-50 text-slate-500"
              />
            </div>
            <Field label="FULL NAME *" name="name" required placeholder="Full Name" />
            <Field label="FATHER'S NAME *" name="fatherName" required placeholder="FATHER'S NAME" />
            <Field label="MOTHER'S NAME *" name="motherName" required placeholder="MOTHER'S NAME" />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                DATE OF BIRTH <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="dateOfBirth"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="ui-input"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">AGE</label>
              <input type="number" name="age" readOnly value={ageValue} className="ui-input bg-slate-50" placeholder="AGE" />
            </div>
            <Field label="CNIC # (FORMAT: XXXXX-XXXXXXX-X) *" name="cnic" required placeholder="CNIC # (FORMAT: xxxxx-xxxxxxx-x)" />
            <Field label="CNIC ISSUE DATE *" name="cnicIssueDate" type="date" required />
            <Field label="CNIC EXPIRY DATE *" name="cnicExpiryDate" type="date" required />
            <Field label="NEXT OF KIN *" name="nextOfKin" required />
            <div className="space-y-3 lg:col-span-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                CONTACT # (FORMAT: +92-300-1234567) <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <input
                  type="text"
                  name="phone"
                  required
                  className="ui-input"
                  placeholder="Primary Contact # (+92-300-1234567)"
                />
                {contactRows.map((idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      name={`phone_secondary_${idx}`}
                      className="ui-input"
                      placeholder="Additional Contact #"
                    />
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-red-600 hover:bg-red-50"
                      onClick={() => setContactRows((prev) => prev.filter((id) => id !== idx))}
                      aria-label="Remove contact number"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="ui-btn ui-btn-secondary inline-flex items-center gap-2"
                onClick={() => {
                  const nextId = contactCounterRef.current++
                  setContactRows((prev) => [...prev, nextId])
                }}
              >
                <Plus className="h-4 w-4" />
                Add Contact Number
              </button>
            </div>
            <SelectField label="RELIGION" name="religion" options={["Islam", "Christianity", "Hinduism", "Other"]} defaultValue="Islam" />
            <Field label="SECT *" name="sect" required placeholder="SECT" />
            <Field label="CAST *" name="cast" required placeholder="CAST" />
            <SelectField label="DESIGNATION (TYPE)" name="designation" options={LEGACY_GUARD_TYPES} defaultValue="Guard" />
            <Field label="SALARY *" name="salary" type="number" placeholder="Salary" required />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Joining Date</label>
              <input
                type="date"
                name="joiningDate"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="ui-input"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Joining Age</label>
              <input type="number" name="joiningAge" readOnly value={joiningAgeValue} className="ui-input bg-slate-50" placeholder="Joining Age" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Enrolled By User</label>
              <input type="text" name="enrolledBy" readOnly value={currentUserName} className="ui-input bg-slate-50" />
            </div>
            <Field label="POLICE STATION *" name="policeStation" required />
            <SelectField label="BLOOD GROUP" name="bloodGroup" options={BLOOD_GROUPS} placeholder="--Select Blood Group--" />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">MARITAL STATUS</label>
              <select
                name="maritalStatus"
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                className="ui-input"
              >
                <option value="">--Select Marital Status--</option>
                {MARITAL_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <SupervisorSelector />
            <Field label="Profile Introducer" name="profileIntroducer" placeholder="Profile Introducer" />
          </div>
        </CollapsibleSection>
      ) : null}

      {sections.bankAccount ? (
        <CollapsibleSection
          title="GUARD BANK ACCOUNT DETAILS"
          collapsed={collapsed.bankAccount}
          onToggle={() => toggleSectionCollapse("bankAccount")}
        >
          <GuardAccountsEditor name="bankAccounts" />
        </CollapsibleSection>
      ) : null}

      {sections.previousEmployment ? (
        <CollapsibleSection
          title="PREVIOUS EMPLOYMENT DETAILS"
          collapsed={collapsed.previousEmployment}
          onToggle={() => toggleSectionCollapse("previousEmployment")}
        >
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-[var(--text)]">ex</span>
            {["ARMY", "POLICE", "RANGERS", "MUJAHID", "OTHER"].map((option) => (
              <label key={option} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="exServiceType"
                  value={option}
                  checked={exServiceType === option}
                  onChange={() => setExServiceType(option)}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                <span>{option}</span>
              </label>
            ))}
            {exServiceType === "OTHER" ? (
              <input
                type="text"
                name="exServiceOtherLabel"
                defaultValue="Civilian"
                className="h-8 w-28 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
                placeholder="Specify..."
              />
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Field label="REGISTRATION NO" name="exServiceRegistrationNo" placeholder="Registration No" />
            <Field label="RANK" name="exServiceRank" placeholder="Rank" />
            <Field label="UNIT" name="exServiceUnit" placeholder="Unit" />
            <Field label="SERVICE PERIOD" name="exServicePeriod" placeholder="Select Date of Enrollment & Date of Discharge" />
            <Field label="YEARS" name="exServiceYears" type="number" placeholder="years" />
            <Field label="MONTHS" name="exServiceMonths" type="number" placeholder="months" />
            <Field label="DATE OF ENROLLMENT" name="dateOfEnrollment" type="date" />
            <Field label="DATE OF DISCHARGE" name="dateOfDischarge" type="date" />
            <Field label="REMARKS" name="exServiceRemarks" placeholder="Remarks" />
          </div>
        </CollapsibleSection>
      ) : null}

      {sections.address ? (
        <CollapsibleSection
          title="ADDRESS DETAIL"
          collapsed={collapsed.address}
          onToggle={() => toggleSectionCollapse("address")}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Field label="CURRENT RESIDENTIAL ADDRESS *" name="addressCurrent" required placeholder="Current Residential Address" />
            <Field label="CURRENT ADDRESS CONTACT NO *" name="currentAddressContact" required placeholder="Current Address Contact No" />
            <Field label="PERMANENT RESIDENTIAL ADDRESS *" name="addressPermanent" required placeholder="Permanent Residential Address" />
            <Field label="PERMANENT ADDRESS CONTACT NO *" name="permanentAddressContact" required placeholder="Permanent Address Contact No" />
          </div>
        </CollapsibleSection>
      ) : null}

      {sections.education ? (
        <CollapsibleSection
          title="EDUCATION"
          collapsed={collapsed.education}
          onToggle={() => toggleSectionCollapse("education")}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <SelectField label="EDUCATION" name="education" options={EDUCATION_LEVELS} placeholder="Choose Education Level" />
            <Field label="YEAR" name="passingYear" placeholder="Year" />
            <Field label="NAME OF INSTITUTE" name="educationInstitute" placeholder="Name Of Institute" />
          </div>
        </CollapsibleSection>
      ) : null}

      {sections.introducer ? (
        <CollapsibleSection
          title="INTRODUCER"
          collapsed={collapsed.introducer}
          onToggle={() => toggleSectionCollapse("introducer")}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Field label="FULL NAME *" name="introducerName" required placeholder="Full Name" />
            <Field label="Introducer's CNIC" name="introducerCnic" placeholder="Introducer's CNIC" />
            <Field label="Introducer's Address" name="introducerAddress" placeholder="Introducer's Address" />
            <Field label="Introducer's Contact" name="introducerContact" placeholder="Introducer's Contact #" />
          </div>
        </CollapsibleSection>
      ) : null}

      {sections.physical ? (
        <CollapsibleSection
          title="PHYSICAL DETAILS"
          collapsed={collapsed.physical}
          onToggle={() => toggleSectionCollapse("physical")}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Field label="HEIGHT *" name="height" required placeholder="Height" />
            <Field label="WEIGHT *" name="weight" required placeholder="Weight" />
            <Field label="EYE COLOR *" name="eyeColor" required placeholder="Eye Color" />
            <Field label="HAIR COLOR *" name="hairColor" required placeholder="Hair Color" />
            <Field label="ANY DISABILITY *" name="disability" required placeholder="Any Disability" />
            <Field label="MARK OF IDENTIFICATION*" name="identificationMark" required placeholder="Mark of Identification" />
          </div>
        </CollapsibleSection>
      ) : null}

      {sections.family ? (
        <CollapsibleSection
          title="ADD FAMILY MEMBER DETAIL"
          collapsed={collapsed.family}
          onToggle={() => toggleSectionCollapse("family")}
          action={(
            <button
              type="button"
              className="ui-btn ui-btn-secondary inline-flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation()
                const nextId = familyCounterRef.current++
                setFamilyRows((prev) => [...prev, nextId])
              }}
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          )}
        >
          <div className="space-y-6">
            {familyRows.map((idx, rowIndex) => (
              <div key={idx} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--text)]">Family Member #{rowIndex + 1}</p>
                  {familyRows.length > 1 ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                      onClick={() => setFamilyRows((prev) => prev.filter((id) => id !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="NAME" name={`family_${idx}_name`} placeholder="NAME" />
                  <Field label="RELATION" name={`family_${idx}_relation`} placeholder="RELATION" />
                  <Field label="AGE" name={`family_${idx}_age`} placeholder="AGE" />
                  <Field label="PROFESSION" name={`family_${idx}_profession`} placeholder="PROFESSION" />
                  <Field label="ADDRESS" name={`family_${idx}_address`} placeholder="ADDRESS" />
                  {maritalStatus === "married" ? (
                    <>
                      <Field label="B-FORM / CNIC (CHILD)" name={`family_${idx}_childCnic`} placeholder="B-Form / CNIC No" />
                      <Field label="CHILD AGE" name={`family_${idx}_childAge`} placeholder="Age" />
                      <Field label="CHILD DATE OF BIRTH" name={`family_${idx}_childDob`} type="date" />
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      {sections.nearestRelative ? (
        <CollapsibleSection
          title="ADD NEAREST RELATIVE DETAIL"
          collapsed={collapsed.nearestRelative}
          onToggle={() => toggleSectionCollapse("nearestRelative")}
          action={(
            <button
              type="button"
              className="ui-btn ui-btn-secondary inline-flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation()
                const nextId = nearestCounterRef.current++
                setNearestRows((prev) => [...prev, nextId])
              }}
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          )}
        >
          <div className="space-y-6">
            {nearestRows.map((idx, rowIndex) => (
              <div key={idx} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--text)]">Nearest Relative #{rowIndex + 1}</p>
                  {nearestRows.length > 1 ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                      onClick={() => setNearestRows((prev) => prev.filter((id) => id !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="NAME" name={`nearest_${idx}_name`} placeholder="NAME" />
                  <Field label="FATHER NAME" name={`nearest_${idx}_fatherName`} placeholder="FATHER NAME" />
                  <Field label="RELATION" name={`nearest_${idx}_relation`} placeholder="RELATION" />
                  <Field label="PROFESSION" name={`nearest_${idx}_profession`} placeholder="PROFESSION" />
                  <Field label="CNIC # (FORMAT: XXXXX-XXXXXXX-X)" name={`nearest_${idx}_cnic`} placeholder="CNIC # (FORMAT: xxxxx-xxxxxxx-x)" />
                  <Field label="CNIC ISSUE DATE" name={`nearest_${idx}_cnicIssueDate`} type="date" />
                  <Field label="CONTACT #" name={`nearest_${idx}_contact`} placeholder="+__-___-_______" />
                  <Field label="ADDRESS" name={`nearest_${idx}_address`} placeholder="ADDRESS" />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      <div className="flex items-center gap-4 pb-4">
        <div className="hidden" aria-hidden="true">
          <select name="legacy_guard_type_options">
            <option>Guard</option>
            <option>location supervisor</option>
            <option>cpo</option>
            <option>SO</option>
            <option>ASO</option>
            <option>LSO</option>
            <option>Receptionist</option>
            <option>CCTV Operator</option>
            <option>Complaint Receiver</option>
          </select>
          <select name="legacy_blood_group_options">
            <option>--Select Blood Group--</option>
            <option>O+ve</option>
            <option>A+ve</option>
            <option>B+ve</option>
            <option>AB+ve</option>
            <option>O-ve</option>
            <option>A-ve</option>
            <option>B-ve</option>
            <option>AB-ve</option>
          </select>
          <select name="legacy_marital_status_options">
            <option>--Select Marital Status--</option>
            <option>single</option>
            <option>married</option>
            <option>divorced</option>
            <option>widowed</option>
            <option>separated</option>
            <option>engaged</option>
          </select>
          <select name="legacy_education_level_options">
            <option>Choose Education Level</option>
            <option>Primary</option>
            <option>Middle</option>
            <option>Matric</option>
            <option>Intermediate</option>
            <option>Graduate</option>
            <option>B.A</option>
            <option>BSc</option>
            <option>M.A</option>
            <option>Msc</option>
          </select>
        </div>
        <input type="hidden" name="3" value="" />
        <input type="hidden" name="68" value="" />
        <input type="hidden" name="71" value="" />
        <input type="hidden" name="88" value="" />
        <input type="hidden" name="107" value="" />
        <input type="hidden" name="108" value="" />
        <input type="hidden" name="110" value="" />
        <input type="hidden" name="111" value="" />
        <input type="hidden" name="FATHER'S NAME *" value="" />
        <input type="hidden" name="MOTHER'S NAME *" value="" />
        <input type="hidden" name="ex" value="ARMY" />
        <input type="hidden" name="Introducer's CNIC" value="" />
        <input type="hidden" name="Introducer's Address" value="" />
        <input type="hidden" name="Introducer's Contact" value="" />
        <input type="hidden" name="FATHER’S NAME *" value="" />
        <input type="hidden" name="MOTHER’S NAME *" value="" />
        <input type="hidden" name="Introducer’s CNIC" value="" />
        <input type="hidden" name="Introducer’s Address" value="" />
        <input type="hidden" name="Introducer’s Contact" value="" />
        <input type="hidden" name="INTRODUCER'S CNIC" value="" />
        <input type="hidden" name="INTRODUCER'S ADDRESS" value="" />
        <input type="hidden" name="INTRODUCER'S CONTACT" value="" />
        <input type="hidden" name="DD-MM-YYYY" value="" />
        <input type="hidden" name="other" value="OTHER" />
        <Link href="/guards" className="ui-btn ui-btn-secondary flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Cancel
        </Link>
        <button type="submit" disabled={loading} className="ui-btn ui-btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="h-4 w-4" />
          {loading ? "Saving..." : "SUBMIT"}
        </button>
      </div>
    </form>
  )
}

function CollapsibleSection({
  title,
  collapsed,
  onToggle,
  children,
  action,
}: {
  title: string
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="ui-card overflow-hidden">
      <div className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--text)]">{title}</span>
        <div className="inline-flex items-center gap-2">
          {action}
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-white text-[var(--text-muted)] hover:bg-[var(--surface)]"
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {!collapsed ? <div className="p-6">{children}</div> : null}
    </div>
  )
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label} {required && !label.includes("*") ? <span className="text-red-500">*</span> : null}
      </label>
      <input type={type} name={name} required={required} className="ui-input" placeholder={placeholder} />
    </div>
  )
}

function SupervisorSelector() {
  const [query, setQuery] = useState("")
  const [guards, setGuards] = useState<Array<{ id: string; name: string; parwestId: string }>>([])
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [fetching, setFetching] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? guards.filter(
          (g) => g.name.toLowerCase().includes(q) || g.parwestId.toLowerCase().includes(q)
        )
      : guards.slice(0, 10)
    return list
  }, [query, guards])

  const fetchGuards = async () => {
    if (guards.length > 0) return
    setFetching(true)
    try {
      const res = await fetch("/api/guards")
      if (res.ok) {
        const data = await res.json() as Array<{ id: string; name: string; parwestId?: string }>
        setGuards(data.map((g) => ({ id: g.id, name: g.name, parwestId: g.parwestId || "" })))
      }
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-medium text-gray-700">Supervisor</label>
      <input type="hidden" name="supervisorId" value={selected?.id || ""} />
      <input type="hidden" name="managerName" value={selected?.name || ""} />
      <div className="relative">
        <input
          type="text"
          className="ui-input pr-8"
          placeholder="Search supervisor by name or ID..."
          value={selected ? selected.name : query}
          onChange={(e) => {
            setSelected(null)
            setQuery(e.target.value)
          }}
          onFocus={() => {
            setOpen(true)
            fetchGuards()
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {selected && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-red-600 text-base leading-none"
            onClick={() => { setSelected(null); setQuery("") }}
            tabIndex={-1}
          >
            ✕
          </button>
        )}
      </div>
      {open && !selected && (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-lg max-h-60 overflow-y-auto">
          {fetching && (
            <p className="px-3 py-2 text-sm text-[var(--text-muted)]">Loading supervisors...</p>
          )}
          {!fetching && filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-[var(--text-muted)]">
              {query ? "No matching guards found" : "No guards in system"}
            </p>
          )}
          {filtered.map((g) => (
            <button
              key={g.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)] flex items-center justify-between gap-2"
              onMouseDown={() => {
                setSelected({ id: g.id, name: g.name })
                setQuery("")
                setOpen(false)
              }}
            >
              <span className="font-medium text-[var(--text)]">{g.name}</span>
              {g.parwestId && (
                <span className="text-xs text-[var(--text-muted)] shrink-0">{g.parwestId}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SelectField({
  label,
  name,
  options,
  defaultValue = "",
  placeholder,
}: {
  label: string
  name: string
  options: Array<string | { label: string; value: string }>
  defaultValue?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
      <select name={name} defaultValue={defaultValue} className="ui-input">
        <option value="">{placeholder || `Select ${label.toLowerCase()}`}</option>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value
          const labelText = typeof option === "string" ? option : option.label
          return (
            <option key={`${name}-${value}`} value={value}>
              {labelText}
            </option>
          )
        })}
      </select>
    </div>
  )
}
