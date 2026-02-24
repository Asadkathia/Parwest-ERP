"use client"

import { type ReactNode, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"

type Region = {
  id: string
  name: string
}

type RegionalOffice = {
  id: string
  name: string
  region: Region
}

type Props = {
  regions: Region[]
  regionalOffices: RegionalOffice[]
}

type SectionConfig = {
  id: string
  label: string
}

const SECTION_CONFIG: SectionConfig[] = [
  { id: "general", label: "GENERAL INFORMATION" },
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

export default function GuardEnrollmentForm({ regions, regionalOffices }: Props) {
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
    const data = Object.fromEntries(formData.entries())
    const cnicValue = String(data.cnic || "").trim()
    const phoneValue = String(data.phone || "").trim()
    const ageValue = String(data.age || "").trim()
    const familyAgeValues = Object.entries(data)
      .filter(([key]) => key.includes("_age"))
      .map(([, value]) => String(value || "").trim())

    if (cnicValue && !/^\d{5}-\d{7}-\d$/.test(cnicValue)) {
      setError("CNIC format must be XXXXX-XXXXXXX-X")
      setLoading(false)
      return
    }

    if (phoneValue && !/^\+92-\d{3}-\d{7}$/.test(phoneValue)) {
      setError("Contact format must be +92-300-1234567")
      setLoading(false)
      return
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
    } catch (err: any) {
      setError(err.message)
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
            <Field label="Parwest ID" name="parwestId" required />
            <Field label="PARWEST SHORT NAME" name="parwest_shortname" placeholder="Short Name" />
            <Field label="FULL NAME *" name="name" required placeholder="Full Name" />
            <Field label="FATHER'S NAME *" name="fatherName" required placeholder="FATHER'S NAME" />
            <Field label="MOTHER'S NAME *" name="motherName" required placeholder="MOTHER'S NAME" />
            <Field label="DATE OF BIRTH *" name="dateOfBirth" type="date" required />
            <Field label="AGE" name="age" type="number" placeholder="AGE" />
            <Field label="CNIC # (FORMAT: XXXXX-XXXXXXX-X) *" name="cnic" required placeholder="CNIC # (FORMAT: xxxxx-xxxxxxx-x)" />
            <Field label="CNIC ISSUE DATE *" name="cnicIssueDate" type="date" required />
            <Field label="CNIC EXPIRY DATE *" name="cnicExpiryDate" type="date" required />
            <Field label="NEXT OF KIN *" name="nextOfKin" required />
            <Field label="CONTACT # (FORMAT: +92-300-1234567) *" name="phone" required placeholder="Contact # (Format: +92-300-1234567)" />
            <Field label="PASSPORT #" name="passportNumber" placeholder="PASSPORT #" />
            <Field label="PASSPORT EXPIRY DATE" name="passportExpiryDate" type="date" />
            <SelectField label="RELIGION" name="religion" options={["Islam", "Christianity", "Hinduism", "Other"]} defaultValue="Islam" />
            <Field label="SECT *" name="sect" required placeholder="SECT" />
            <Field label="CAST *" name="cast" required placeholder="CAST" />
            <SelectField label="DESIGNATION (TYPE)" name="designation" options={LEGACY_GUARD_TYPES} defaultValue="Guard" />
            <Field label="SALARY *" name="salary" type="number" placeholder="Salary" required />
            <Field label="POLICE STATION *" name="policeStation" required />
            <SelectField label="BLOOD GROUP" name="bloodGroup" options={BLOOD_GROUPS} placeholder="--Select Blood Group--" />
            <SelectField label="MARITAL STATUS" name="maritalStatus" options={MARITAL_STATUSES} placeholder="--Select Marital Status--" />
            <SelectField label="Region" name="regionId" options={regions.map((r) => ({ label: r.name, value: r.id }))} />
            <SelectField
              label="Regional Office"
              name="regionalOfficeId"
              options={[
                { label: "head office lahore", value: "legacy-head-office-lahore" },
                ...regionalOffices.map((office) => ({ label: `${office.name} (${office.region.name})`, value: office.id })),
              ]}
            />
          </div>
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
                <input type="radio" name="exServiceType" value={option} defaultChecked={option === "ARMY"} className="h-4 w-4 accent-[var(--brand)]" />
                <span>{option}</span>
              </label>
            ))}
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
