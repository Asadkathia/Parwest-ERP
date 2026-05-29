"use client"

import { type ReactNode, useMemo, useRef, useState, useEffect, useCallback } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"
import GuardAccountsEditor from "@/components/guards/GuardAccountsEditor"
import type { GuardBankAccount } from "@/lib/guards/bank-accounts"
import PhoneInput from "@/components/ui/PhoneInput"
import CnicInput from "@/components/ui/CnicInput"
import { isValidGuardAge, CNIC_REGEX } from "@/lib/validation/formats"
import { validateEducationPassingYear } from "@/lib/validation/guard-dates"
import { isValidGuardPhone } from "@/lib/guards/validate-payload"

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
  /** When set, the user is locked to a single regional office — selector is hidden and value hardcoded. */
  lockedRegionalOfficeId?: string | null
  /** When set, the user is regionally scoped — informational; office list is already pre-filtered server-side. */
  lockedRegionId?: string | null
}

type SectionConfig = {
  id: string
  label: string
  required?: boolean
}

const SECTION_CONFIG: SectionConfig[] = [
  { id: "general", label: "GENERAL INFORMATION" },
  { id: "bankAccount", label: "GUARD BANK ACCOUNT DETAILS" },
  { id: "previousEmployment", label: "PREVIOUS EMPLOYMENT DETAILS" },
  { id: "address", label: "ADDRESS DETAIL" },
  { id: "education", label: "EDUCATION" },
  { id: "introducer", label: "INTRODUCER" },
  { id: "physical", label: "PHYSICAL DETAILS" },
  { id: "family", label: "ADD FAMILY MEMBER DETAIL", required: true },
  { id: "nearestRelative", label: "ADD NEAREST RELATIVE DETAIL", required: true },
]


const EDUCATION_LEVELS = ["Primary", "Middle", "Matric", "Intermediate", "Graduate", "B.A", "BSc", "M.A", "Msc"]
const BLOOD_GROUPS = ["O+ve", "A+ve", "B+ve", "AB+ve", "O-ve", "A-ve", "B-ve", "AB-ve"]
const MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "separated", "engaged"]
const PREREQUISITE_ITEMS_FALLBACK = [
  "NADRA Verification",
  "Health Certificate Verification",
  "Police Verification",
  "Eyesight Certificate",
  "Character Verification",
  "Mental Health Check",
  "3rd Guarantor Verification",
  "Company Card & CNIC",
]

function useSectionChecklist() {
  const initial = Object.fromEntries(SECTION_CONFIG.map((s) => [s.id, true])) as Record<string, boolean>

  const [sections, setSections] = useState<Record<string, boolean>>(initial)
  const allSelected = useMemo(() => Object.values(sections).every(Boolean), [sections])

  const toggle = (id: string) => {
    const cfg = SECTION_CONFIG.find((s) => s.id === id)
    if (cfg?.required) return
    setSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }
  const setAll = (value: boolean) => {
    setSections(Object.fromEntries(
      SECTION_CONFIG.map((s) => [s.id, s.required ? true : value])
    ) as Record<string, boolean>)
  }

  const setSection = (id: string, value: boolean) =>
    setSections((prev) => ({ ...prev, [id]: value }))

  return { sections, toggle, allSelected, setAll, setSection }
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

/** Compute total months between two ISO date strings; returns { years, months } or null. */
function computeDurationFromDates(startIso: string, endIso: string): { years: number; months: number } | null {
  if (!startIso || !endIso) return null
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (end < start) return null
  let totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) totalMonths -= 1
  if (totalMonths < 0) return null
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 }
}

function formatDuration(d: { years: number; months: number } | null): string {
  if (!d) return ""
  return `${d.years} year${d.years === 1 ? "" : "s"}, ${d.months} month${d.months === 1 ? "" : "s"}`
}

export default function GuardEnrollmentForm({ regionalOffices, currentUserName, lockedRegionalOfficeId = null, lockedRegionId: _lockedRegionId = null }: Props) {
  void _lockedRegionId
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const { sections, toggle, allSelected, setAll, setSection } = useSectionChecklist()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => Object.fromEntries(SECTION_CONFIG.map((s) => [s.id, false])) as Record<string, boolean>
  )
  const [dbPrereqItems, setDbPrereqItems] = useState<string[]>(PREREQUISITE_ITEMS_FALLBACK)
  const [prerequisites, setPrerequisites] = useState<Record<string, boolean>>({})

  const loadPrereqItems = useCallback(async () => {
    try {
      const res = await fetch("/api/guard-document-types?activeOnly=true")
      if (!res.ok) return
      const data: { name: string }[] = await res.json()
      if (data.length > 0) {
        const names = data.map((d) => d.name)
        setDbPrereqItems(names)
        setPrerequisites(Object.fromEntries(names.map((n) => [n.toLowerCase().replace(/[^a-z0-9]+/g, "_"), false])))
      } else {
        setPrerequisites(Object.fromEntries(PREREQUISITE_ITEMS_FALLBACK.map((n) => [n.toLowerCase().replace(/[^a-z0-9]+/g, "_"), false])))
      }
    } catch {
      setPrerequisites(Object.fromEntries(PREREQUISITE_ITEMS_FALLBACK.map((n) => [n.toLowerCase().replace(/[^a-z0-9]+/g, "_"), false])))
    }
  }, [])

  useEffect(() => { loadPrereqItems() }, [loadPrereqItems])

  const [familyRows, setFamilyRows] = useState([0])
  const [nearestRows, setNearestRows] = useState([0])
  const familyCounterRef = useRef(1)
  const nearestCounterRef = useRef(1)
  const [contactRows, setContactRows] = useState<number[]>([])
  const contactCounterRef = useRef(2)
  const [selectedRegionalOfficeId, setSelectedRegionalOfficeId] = useState(lockedRegionalOfficeId || "")
  const [dateOfBirth, setDateOfBirth] = useState("")
  // Joining date is always the day of enrollment — locked, no picker.
  const joiningDate = useMemo(() => new Date().toISOString().split("T")[0], [])
  const [maritalStatus, setMaritalStatus] = useState("")

  // Local RHF form to back GuardAccountsEditor (post-shadcn migration requires `control`).
  // The serialized JSON is mirrored into a hidden form input below so the FormData
  // submit pipeline sees `bankAccounts` exactly as before.
  const accountsForm = useForm<{ bankAccounts: GuardBankAccount[] }>({
    defaultValues: {
      bankAccounts: [
        {
          id: `acc-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
          bankName: "",
          accountTitle: "",
          accountNumber: "",
          iban: "",
          branchCode: "",
          branchLocation: "",
          accountType: "SAVINGS",
          accountStatus: "ACTIVE",
          walletType: "BANK",
          isActive: true,
        },
      ],
    },
  })
  const watchedAccounts = useWatch({ control: accountsForm.control, name: "bankAccounts" })
  const serializedAccounts = useMemo(
    () => JSON.stringify(watchedAccounts ?? []),
    [watchedAccounts],
  )

  // Dynamic ex-service types
  const [exServiceTypeOptions, setExServiceTypeOptions] = useState<string[]>([])
  type PreviousEmp = {
    type: string
    isExService: boolean
    // Ex-service fields
    registrationNo: string
    rank: string
    unit: string
    // Civilian fields
    nameOfCompany: string
    designation: string
    reasonForLeaving: string
    // Common fields
    dateOfEnrollment: string
    dateOfDischarge: string
    years: string
    months: string
    remarks: string
  }
  const emptyEmp = (): PreviousEmp => ({ type: "", isExService: false, registrationNo: "", rank: "", unit: "", nameOfCompany: "", designation: "", reasonForLeaving: "", dateOfEnrollment: "", dateOfDischarge: "", years: "", months: "", remarks: "" })
  const [prevEmployments, setPrevEmployments] = useState<PreviousEmp[]>([])
  const [guardEmploymentType, setGuardEmploymentType] = useState<string>("")
  const empCounterRef = useRef(0)

  useEffect(() => {
    fetch("/api/guard-ex-service-types?activeOnly=true")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Array<{ name: string }>) => setExServiceTypeOptions(data.map((d) => d.name)))
      .catch(() => setExServiceTypeOptions([]))
  }, [])
  const ageValue = useMemo(() => calculateAge(dateOfBirth), [dateOfBirth])
  const joiningAgeValue = useMemo(() => calculateAge(dateOfBirth, joiningDate), [dateOfBirth, joiningDate])

  const toggleSectionCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleGuardEmploymentTypeChange = (next: string) => {
    setGuardEmploymentType(next)
    if (next && next !== "CIVILIAN") {
      // Force-enable the section, expand it, and seed an empty matching ex-service
      // row so the user can immediately fill in Registration No / Rank / Unit.
      setSection("previousEmployment", true)
      setCollapsed((prev) => ({ ...prev, previousEmployment: false }))
      setPrevEmployments((prev) =>
        prev.some((e) => e.type === next)
          ? prev
          : [...prev, { ...emptyEmp(), type: next, isExService: true }]
      )
    }
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
    setPrerequisites(
      Object.fromEntries(dbPrereqItems.map((n) => [n.toLowerCase().replace(/[^a-z0-9]+/g, "_"), value])) as Record<string, boolean>
    )
  }

  const applyOcrFields = (fields: Record<string, string>) => {
    const form = formRef.current

    Object.entries(fields).forEach(([name, value]) => {
      // Update React-controlled state first
      if (name === "dateOfBirth") { setDateOfBirth(value); return }
      if (name === "maritalStatus") { setMaritalStatus(value); return }

      // For all other fields update the DOM input directly
      if (!form) return
      const input = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null
      if (!input) return

      // Use React's synthetic event so React-uncontrolled inputs pick up the value
      const nativeSetter = Object.getOwnPropertyDescriptor(
        input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : input instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype,
        "value"
      )?.set
      nativeSetter?.call(input, value)
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })
  }

  // Browser-native HTML5 validation surface — fires when a `required` input
  // fails before our async `handleSubmit` runs. Without this, the user can
  // perceive SUBMIT as silent because the failed control may be inside a
  // collapsed section. Capture the first invalid field per submit attempt.
  const invalidHandledRef = useRef(false)
  const handleInvalid = (e: React.FormEvent<HTMLFormElement>) => {
    if (invalidHandledRef.current) return
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    if (!target) return
    invalidHandledRef.current = true
    const label =
      (target.labels && target.labels[0]?.textContent?.trim()) ||
      target.getAttribute("aria-label") ||
      target.getAttribute("placeholder") ||
      target.name ||
      "A required field"
    const message =
      target.validationMessage && target.validationMessage.length > 0
        ? `${label}: ${target.validationMessage}`
        : `${label} is required.`
    toast.error(message)
    // Reset latch so subsequent submit attempts surface again.
    setTimeout(() => { invalidHandledRef.current = false }, 0)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    /** Surface a validation failure both in the inline banner and as a toast. */
    const fail = (message: string) => {
      setError(message)
      toast.error(message)
      setLoading(false)
    }

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
      fail("CNIC format must be XXXXX-XXXXXXX-X")
      return
    }

    const dobForAge = String(data.dateOfBirth || "").trim()
    if (!dobForAge || !isValidGuardAge(dobForAge)) {
      fail("Guard must be between 18 and 65 years old.")
      return
    }

    if (contactNumbers.length === 0) {
      fail("At least one contact number is required.")
      return
    }

    for (const number of contactNumbers) {
      if (!isValidGuardPhone(number)) {
        fail("Contact format must be +92-300-1234567")
        return
      }
    }

    // Validate address contact numbers when the address section is included
    if (sections.address) {
      const currentContact = String(data.currentAddressContact || "").trim()
      const permanentContact = String(data.permanentAddressContact || "").trim()
      if (currentContact && !isValidGuardPhone(currentContact)) {
        fail("Current Address Contact No format must be +92-300-1234567")
        return
      }
      if (permanentContact && !isValidGuardPhone(permanentContact)) {
        fail("Permanent Address Contact No format must be +92-300-1234567")
        return
      }
    }

    // Validate CNIC dates
    const cnicIssueDate = formData.get("cnicIssueDate") as string
    const cnicExpiryDate = formData.get("cnicExpiryDate") as string
    if (cnicIssueDate && cnicExpiryDate) {
      if (new Date(cnicIssueDate) >= new Date(cnicExpiryDate)) {
        fail("CNIC Issue Date must be before the CNIC Expiry Date.")
        return
      }
    }

    if (ageValue && (!Number.isFinite(Number(ageValue)) || Number(ageValue) < 0)) {
      fail("Please enter a valid age")
      return
    }

    for (const familyAge of familyAgeValues) {
      if (familyAge && (!Number.isFinite(Number(familyAge)) || Number(familyAge) < 0)) {
        fail("Please enter a valid age")
        return
      }
    }

    // Validate general section required fields that HTML required can't catch (hidden inputs + selects)
    if (sections.general) {
      if (!String(data.supervisorId || "").trim()) {
        fail("Supervisor is required.")
        return
      }
      if (!String(data.bloodGroup || "").trim()) {
        fail("Blood Group is required.")
        return
      }
      if (!String(data.maritalStatus || "").trim()) {
        fail("Marital Status is required.")
        return
      }
    }

    // Validate family members (required — at least one with a name)
    const hasAnyFamilyName = familyRows.some((idx) => String(data[`family_${idx}_name`] || "").trim())
    if (!hasAnyFamilyName) {
      fail("At least one family member detail is required. Please fill in the Name field.")
      return
    }

    // Validate nearest relatives (required — at least one with a name)
    const hasAnyNearestName = nearestRows.some((idx) => String(data[`nearest_${idx}_name`] || "").trim())
    if (!hasAnyNearestName) {
      fail("At least one nearest relative detail is required. Please fill in the Name field.")
      return
    }

    // Validate nearest relative contact + CNIC formats (when supplied)
    for (const idx of nearestRows) {
      const contact = String(data[`nearest_${idx}_contact`] || "").trim()
      if (contact && !isValidGuardPhone(contact)) {
        fail("Nearest Relative Contact # format must be +92-300-1234567")
        return
      }
      const relativeCnic = String(data[`nearest_${idx}_cnic`] || "").trim()
      if (relativeCnic && !CNIC_REGEX.test(relativeCnic)) {
        fail("Nearest Relative CNIC format must be XXXXX-XXXXXXX-X")
        return
      }
    }

    // Validate introducer CNIC + contact formats (optional, checked when supplied)
    const introducerCnicValue = String(data.introducerCnic || "").trim()
    if (introducerCnicValue && !CNIC_REGEX.test(introducerCnicValue)) {
      fail("Introducer CNIC format must be XXXXX-XXXXXXX-X")
      return
    }
    const introducerContactValue = String(data.introducerContact || "").trim()
    if (introducerContactValue && !isValidGuardPhone(introducerContactValue)) {
      fail("Introducer Contact format must be +92-300-1234567")
      return
    }

    // Education passing year must be after the date of birth (shared rule)
    const educationYearError = validateEducationPassingYear(dobForAge, String(data.passingYear || ""))
    if (educationYearError) {
      fail(educationYearError)
      return
    }

    // Validate bank accounts
    if (sections.bankAccount) {
      let parsedAccounts: Array<Record<string, unknown>> = []
      try {
        const raw = String(data.bankAccounts || "[]")
        parsedAccounts = JSON.parse(raw)
      } catch { /* ignore */ }
      if (parsedAccounts.length === 0) {
        fail("At least one bank account is required.")
        return
      }
      for (const acc of parsedAccounts) {
        const kind = acc.walletType === "BANK" ? "bank" : "wallet"
        if (!String(acc.bankName || "").trim()) {
          fail(`Bank account: ${kind === "bank" ? "Bank Name" : "Wallet Type"} is required.`)
          return
        }
        if (!String(acc.accountNumber || "").trim()) {
          fail("Bank account: Account Number is required.")
          return
        }
        if (!String(acc.accountTitle || "").trim()) {
          fail("Bank account: Account Title is required.")
          return
        }
        if (kind === "bank" && !String(acc.branchLocation || "").trim()) {
          fail("Bank account: Branch Location is required.")
          return
        }
      }
    }

    // Validate Guard Employment Type — only when the Previous Employment
    // section is checked on the section checklist. Hidden sections must not
    // block submit for fields the user cannot see.
    if (sections.previousEmployment) {
      if (!guardEmploymentType) {
        fail("Guard Employment Type is required.")
        return
      }
      if (guardEmploymentType !== "CIVILIAN") {
        const matching = prevEmployments.filter((e) => e.type === guardEmploymentType)
        if (matching.length === 0) {
          fail(`At least one previous employment record with type ${guardEmploymentType} is required.`)
          return
        }
        const incomplete = matching.find(
          (e) => !e.registrationNo.trim() || !e.rank.trim() || !e.unit.trim()
        )
        if (incomplete) {
          fail(`${guardEmploymentType} employment record requires Registration No, Rank, and Unit.`)
          return
        }
      }
      for (const emp of prevEmployments) {
        if (!emp.type) {
          fail("Each previous employment record must have an Employment Type selected.")
          return
        }
      }
    }

    try {
      data.phone = contactNumbers[0]
      data.additionalContactNumbers = contactNumbers.slice(1).join(", ")
      // Inject previousEmploymentsJson — derive years/months from dates so the
      // backend (which reads fe.years / fe.months) gets a consistent value
      // computed from the start/end pickers.
      if (prevEmployments.length > 0) {
        const enriched = prevEmployments.map((e) => {
          const d = computeDurationFromDates(e.dateOfEnrollment, e.dateOfDischarge)
          return {
            ...e,
            years: d ? String(d.years) : "",
            months: d ? String(d.months) : "",
          }
        })
        data.previousEmploymentsJson = JSON.stringify(enriched)
      }
      data.exServiceType = guardEmploymentType
      data.isExService = guardEmploymentType !== "CIVILIAN" ? "true" : "false"

      const response = await fetch("/api/guards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const payload = await response.json().catch(() => ({} as Record<string, unknown>))

      if (!response.ok) {
        // Per CLAUDE.md API envelope: clients read `data.message`, NOT `data.error`.
        const message =
          (typeof payload.message === "string" && payload.message) ||
          "Failed to enroll guard"
        toast.error(message)
        setError(message)
        setLoading(false)
        return
      }

      // Pull the Parwest ID from whichever shape the API returned.
      const parwestId =
        (payload && typeof payload === "object" && "parwestId" in payload && typeof (payload as { parwestId?: unknown }).parwestId === "string"
          ? (payload as { parwestId: string }).parwestId
          : undefined) ??
        (payload && typeof payload === "object" && "data" in payload && payload.data && typeof payload.data === "object" && "parwestId" in (payload as { data: Record<string, unknown> }).data
          ? String((payload as { data: { parwestId?: unknown } }).data.parwestId ?? "")
          : undefined) ??
        (payload && typeof payload === "object" && "guard" in payload && payload.guard && typeof payload.guard === "object" && "parwestId" in (payload as { guard: Record<string, unknown> }).guard
          ? String((payload as { guard: { parwestId?: unknown } }).guard.parwestId ?? "")
          : undefined)

      toast.success("Guard enrolled successfully", {
        description: parwestId ? `Parwest ID: ${parwestId}` : undefined,
      })
      setSuccess("Guard created successfully.")
      router.push("/guards")
      router.refresh()
    } catch (err: unknown) {
      const description = err instanceof Error ? err.message : undefined
      toast.error("Network error. Please try again.", { description })
      setError(description ?? "Unexpected error")
      setLoading(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onInvalidCapture={handleInvalid} className="space-y-6">
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
          {dbPrereqItems.map((item) => {
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
          <label key={section.id} className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 ${section.required ? "cursor-default" : ""}`}>
            <input
              type="checkbox"
              checked={sections[section.id]}
              onChange={() => toggleChecklistSection(section.id)}
              className="h-4 w-4 accent-[var(--brand)]"
              disabled={section.required}
            />
            <span className={sections[section.id] ? "text-sm text-[var(--text)] line-through" : "text-sm text-[var(--text)]"}>
              {section.label}
            </span>
            {section.required ? <span className="ml-1 text-xs font-medium text-red-500">(required)</span> : null}
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
            {lockedRegionalOfficeId ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Regional Office <span className="text-red-500">*</span>
                </label>
                <input type="hidden" name="regionalOfficeId" value={lockedRegionalOfficeId} />
                <input
                  type="text"
                  readOnly
                  value={(() => {
                    const office = regionalOffices.find((o) => o.id === lockedRegionalOfficeId)
                    return office ? `${office.name} (${office.region.name})` : "Locked to your regional office"
                  })()}
                  className="ui-input bg-slate-50 text-slate-600"
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">Locked to your assigned regional office.</p>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Regional Office <span className="text-red-500">*</span>
                </label>
                <select
                  name="regionalOfficeId"
                  required
                  className="ui-input"
                  value={selectedRegionalOfficeId}
                  onChange={(e) => setSelectedRegionalOfficeId(e.target.value)}
                >
                  <option value="">Select regional office</option>
                  {regionalOffices.map((office) => (
                    <option key={`regionalOffice-${office.id}`} value={office.id}>
                      {office.name} ({office.region.name})
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                aria-invalid={Boolean(dateOfBirth && !isValidGuardAge(dateOfBirth))}
              />
              {dateOfBirth && !isValidGuardAge(dateOfBirth) && (
                <p className="mt-1 text-[11px] text-red-500">
                  Guard must be between 18 and 65 years old.
                </p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">AGE</label>
              <input type="number" name="age" readOnly value={ageValue} className="ui-input bg-slate-50" placeholder="AGE" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                CNIC # (FORMAT: XXXXX-XXXXXXX-X) <span className="text-red-500">*</span>
              </label>
              <CnicInput
                name="cnic"
                required
                placeholder="CNIC # (FORMAT: xxxxx-xxxxxxx-x)"
                uniqueCheckUrl="/api/guards/check-cnic"
              />
            </div>
            <Field label="CNIC ISSUE DATE *" name="cnicIssueDate" type="date" required />
            <Field label="CNIC EXPIRY DATE *" name="cnicExpiryDate" type="date" required />
            <Field label="NEXT OF KIN *" name="nextOfKin" required />
            <Field label="NATIONALITY *" name="nationality" required placeholder="e.g. Pakistani" />
            <div className="space-y-3 lg:col-span-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                CONTACT # (FORMAT: +92-300-1234567) <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <PhoneInput name="phone" required />
                {contactRows.map((idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <PhoneInput name={`phone_secondary_${idx}`} />
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-red-600 hover:bg-red-50"
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
            <SelectField label="RELIGION" name="religion" options={["Islam", "Christianity", "Hinduism", "Other"]} defaultValue="Islam" required />
            <Field label="SECT *" name="sect" required placeholder="SECT" />
            <Field label="CAST *" name="cast" required placeholder="CAST" />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Joining Date</label>
              <input
                type="text"
                name="joiningDate"
                value={joiningDate}
                readOnly
                className="ui-input bg-slate-50"
              />
              <p className="mt-1 text-xs text-gray-500">Auto-set to today (date of enrollment).</p>
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
            <SelectField label="BLOOD GROUP" name="bloodGroup" options={BLOOD_GROUPS} placeholder="--Select Blood Group--" required />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                MARITAL STATUS <span className="text-red-500">*</span>
              </label>
              <select
                name="maritalStatus"
                required
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
            <SupervisorSelector regionalOfficeId={selectedRegionalOfficeId} required />
            <Field label="PROFILE INTRODUCER *" name="profileIntroducer" required placeholder="Profile Introducer" />
          </div>
        </CollapsibleSection>
      ) : null}

      {sections.bankAccount ? (
        <CollapsibleSection
          title="GUARD BANK ACCOUNT DETAILS"
          collapsed={collapsed.bankAccount}
          onToggle={() => toggleSectionCollapse("bankAccount")}
        >
          <GuardAccountsEditor control={accountsForm.control} name="bankAccounts" />
          {/* Mirror RHF state into a hidden FormData field so the legacy submit handler keeps working */}
          <input type="hidden" name="bankAccounts" value={serializedAccounts} readOnly />
        </CollapsibleSection>
      ) : null}

      {sections.previousEmployment ? (
        <CollapsibleSection
          title="PREVIOUS EMPLOYMENT DETAILS"
          collapsed={collapsed.previousEmployment}
          onToggle={() => toggleSectionCollapse("previousEmployment")}
        >
          <div className="space-y-4">
            {/* Top-level guard employment type — drives PBA SA-10 vs SA-11 */}
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Guard Employment Type <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="guardEmploymentType"
                    checked={guardEmploymentType === "CIVILIAN"}
                    onChange={() => handleGuardEmploymentTypeChange("CIVILIAN")}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  Civilian
                </label>
                {exServiceTypeOptions.map((t) => (
                  <label key={t} className="inline-flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="guardEmploymentType"
                      checked={guardEmploymentType === t}
                      onChange={() => handleGuardEmploymentTypeChange(t)}
                      className="h-4 w-4 accent-[var(--brand)]"
                    />
                    {t}
                  </label>
                ))}
                {exServiceTypeOptions.length === 0 && (
                  <span className="text-xs text-[var(--text-muted)]">Loading types…</span>
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {guardEmploymentType === "CIVILIAN"
                  ? "Civilian — adding previous employment records is optional."
                  : guardEmploymentType
                  ? `${guardEmploymentType} — at least one ${guardEmploymentType} record with Registration No, Rank, and Unit is required.`
                  : "Required. Determines applicable PBA documents (SA-10 for ex-service, SA-11 for civilian)."}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-muted)]">
                Add all previous employment records — both <strong>Civilian</strong> and <strong>Ex-Service</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  const id = empCounterRef.current++
                  setPrevEmployments((prev) => [...prev, { ...emptyEmp() }])
                  void id
                }}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Employment
              </button>
            </div>

            {prevEmployments.length === 0 && (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-6 py-5 text-center text-sm text-[var(--text-muted)]">
                No previous employment records added
              </div>
            )}

            {prevEmployments.map((emp, idx) => (
              <div key={idx} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--text)]">Employment {idx + 1}</p>
                  <button
                    type="button"
                    onClick={() => setPrevEmployments((prev) => prev.filter((_, i) => i !== idx))}
                    className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>

                {/* Type selection — Civilian + all ex-service types */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Employment Type <span className="text-red-500">*</span></label>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        checked={emp.type === "CIVILIAN"}
                        onChange={() => setPrevEmployments((prev) => prev.map((e, i) => i === idx ? { ...e, type: "CIVILIAN", isExService: false } : e))}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      Civilian
                    </label>
                    {exServiceTypeOptions.map((t) => (
                      <label key={t} className="inline-flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          checked={emp.type === t}
                          onChange={() => setPrevEmployments((prev) => prev.map((e, i) => i === idx ? { ...e, type: t, isExService: true } : e))}
                          className="h-4 w-4 accent-[var(--brand)]"
                        />
                        {t}
                      </label>
                    ))}
                    {exServiceTypeOptions.length === 0 && (
                      <span className="text-xs text-[var(--text-muted)]">Loading ex-service types…</span>
                    )}
                  </div>
                </div>

                {/* Civilian fields */}
                {emp.type === "CIVILIAN" && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">COMPANY NAME <span className="text-red-500">*</span></label>
                      <input type="text" className="ui-input" placeholder="Name of Company" value={emp.nameOfCompany} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, nameOfCompany: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">DESIGNATION / POSITION</label>
                      <input type="text" className="ui-input" placeholder="Designation" value={emp.designation} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, designation: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">DATE OF JOINING</label>
                      <input type="date" className="ui-input" value={emp.dateOfEnrollment} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, dateOfEnrollment: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">DATE OF LEAVING</label>
                      <input type="date" className="ui-input" value={emp.dateOfDischarge} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, dateOfDischarge: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">DURATION</label>
                      <p className="text-sm text-muted-foreground py-2">
                        {formatDuration(computeDurationFromDates(emp.dateOfEnrollment, emp.dateOfDischarge)) || "—"}
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">REASON FOR LEAVING</label>
                      <input type="text" className="ui-input" placeholder="Reason for leaving" value={emp.reasonForLeaving} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, reasonForLeaving: e.target.value } : p))} />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">REMARKS</label>
                      <input type="text" className="ui-input" placeholder="Remarks" value={emp.remarks} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, remarks: e.target.value } : p))} />
                    </div>
                  </div>
                )}

                {/* Ex-service fields */}
                {emp.type && emp.type !== "CIVILIAN" && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">REGISTRATION NO</label>
                      <input type="text" className="ui-input" placeholder="Registration No" value={emp.registrationNo} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, registrationNo: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">RANK</label>
                      <input type="text" className="ui-input" placeholder="Rank" value={emp.rank} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, rank: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">UNIT</label>
                      <input type="text" className="ui-input" placeholder="Unit" value={emp.unit} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, unit: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">DATE OF ENROLLMENT</label>
                      <input type="date" className="ui-input" value={emp.dateOfEnrollment} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, dateOfEnrollment: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">DATE OF DISCHARGE</label>
                      <input type="date" className="ui-input" value={emp.dateOfDischarge} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, dateOfDischarge: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">DURATION</label>
                      <p className="text-sm text-muted-foreground py-2">
                        {formatDuration(computeDurationFromDates(emp.dateOfEnrollment, emp.dateOfDischarge)) || "—"}
                      </p>
                    </div>
                    <div className="lg:col-span-3">
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">REMARKS</label>
                      <input type="text" className="ui-input" placeholder="Remarks" value={emp.remarks} onChange={(e) => setPrevEmployments((prev) => prev.map((p, i) => i === idx ? { ...p, remarks: e.target.value } : p))} />
                    </div>
                  </div>
                )}
              </div>
            ))}
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
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                CURRENT ADDRESS CONTACT NO <span className="text-red-500">*</span>
              </label>
              <PhoneInput name="currentAddressContact" required />
            </div>
            <Field label="PERMANENT RESIDENTIAL ADDRESS *" name="addressPermanent" required placeholder="Permanent Residential Address" />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                PERMANENT ADDRESS CONTACT NO <span className="text-red-500">*</span>
              </label>
              <PhoneInput name="permanentAddressContact" required />
            </div>
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
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Introducer&apos;s CNIC</label>
              <CnicInput name="introducerCnic" placeholder="Introducer's CNIC" />
            </div>
            <Field label="Introducer's Address" name="introducerAddress" placeholder="Introducer's Address" />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Introducer&apos;s Contact</label>
              <PhoneInput name="introducerContact" />
            </div>
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
                  <Field label="NAME *" name={`family_${idx}_name`} required placeholder="NAME" />
                  <Field label="RELATION *" name={`family_${idx}_relation`} required placeholder="RELATION" />
                  <Field label="AGE *" name={`family_${idx}_age`} required placeholder="AGE" />
                  <Field label="PROFESSION *" name={`family_${idx}_profession`} required placeholder="PROFESSION" />
                  <Field label="ADDRESS *" name={`family_${idx}_address`} required placeholder="ADDRESS" />
                  {maritalStatus === "married" ? (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          B-FORM / CNIC (CHILD) <span className="text-red-500">*</span>
                        </label>
                        <CnicInput name={`family_${idx}_childCnic`} required placeholder="B-Form / CNIC No" />
                      </div>
                      <Field label="CHILD AGE *" name={`family_${idx}_childAge`} required placeholder="Age" />
                      <Field label="CHILD DATE OF BIRTH *" name={`family_${idx}_childDob`} required type="date" />
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
                  <Field label="NAME *" name={`nearest_${idx}_name`} required placeholder="NAME" />
                  <Field label="FATHER NAME *" name={`nearest_${idx}_fatherName`} required placeholder="FATHER NAME" />
                  <Field label="RELATION *" name={`nearest_${idx}_relation`} required placeholder="RELATION" />
                  <Field label="PROFESSION *" name={`nearest_${idx}_profession`} required placeholder="PROFESSION" />
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      CNIC # (FORMAT: XXXXX-XXXXXXX-X) <span className="text-red-500">*</span>
                    </label>
                    <CnicInput name={`nearest_${idx}_cnic`} required placeholder="CNIC # (FORMAT: xxxxx-xxxxxxx-x)" />
                  </div>
                  <Field label="CNIC ISSUE DATE *" name={`nearest_${idx}_cnicIssueDate`} required type="date" />
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      CONTACT # <span className="text-red-500">*</span>
                    </label>
                    <PhoneInput name={`nearest_${idx}_contact`} required />
                  </div>
                  <Field label="ADDRESS *" name={`nearest_${idx}_address`} required placeholder="ADDRESS" />
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
    <div className="ui-card">
      <div className={`flex w-full items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 rounded-t-[var(--radius-lg)] ${collapsed ? "rounded-b-[var(--radius-lg)] border-b-0" : ""}`}>
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

function SupervisorSelector({ regionalOfficeId, required }: { regionalOfficeId: string; required?: boolean }) {
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [fetching, setFetching] = useState(false)

  // Reset and refetch when regional office changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dependent async-loaded fields when RO changes
    setSelected(null)
    setQuery("")
    setUsers([])
    if (!regionalOfficeId) return
    setFetching(true)
    fetch(`/api/users/supervisors?regionalOfficeId=${regionalOfficeId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Array<{ id: string; name: string; email: string }>) => setUsers(data))
      .catch(() => setUsers([]))
      .finally(() => setFetching(false))
  }, [regionalOfficeId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : users.slice(0, 15)
  }, [query, users])

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-medium text-gray-700">
        Supervisor {required ? <span className="text-red-500">*</span> : null}
      </label>
      <input type="hidden" name="supervisorId" value={selected?.id || ""} />
      <input type="hidden" name="managerName" value={selected?.name || ""} />
      {!regionalOfficeId ? (
        <div className="ui-input bg-gray-50 text-gray-400 text-sm cursor-not-allowed">
          Select a regional office first
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            className="ui-input pr-8"
            placeholder={fetching ? "Loading supervisors..." : "Search supervisor by name..."}
            value={selected ? selected.name : query}
            onChange={(e) => { setSelected(null); setQuery(e.target.value) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            autoComplete="off"
            disabled={fetching}
          />
          {selected && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-red-600"
              onClick={() => { setSelected(null); setQuery("") }}
              tabIndex={-1}
            >✕</button>
          )}
        </div>
      )}
      {open && !selected && regionalOfficeId && (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-lg max-h-60 overflow-y-auto">
          {fetching && <p className="px-3 py-2 text-sm text-[var(--text-muted)]">Loading...</p>}
          {!fetching && filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-[var(--text-muted)]">
              {query ? "No matching supervisors" : "No supervisors in this office"}
            </p>
          )}
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)] flex items-center justify-between gap-2"
              onMouseDown={() => { setSelected({ id: u.id, name: u.name }); setQuery(""); setOpen(false) }}
            >
              <span className="font-medium text-[var(--text)]">{u.name}</span>
              <span className="text-xs text-[var(--text-muted)] shrink-0">{u.email}</span>
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
  required,
}: {
  label: string
  name: string
  options: Array<string | { label: string; value: string }>
  defaultValue?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      <select name={name} defaultValue={defaultValue} required={required} className="ui-input">
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
