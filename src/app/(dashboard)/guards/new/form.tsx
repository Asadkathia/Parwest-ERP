/**
 * Parwest ERP — Guard Create Wizard (Phase 3b' reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * 6-step shadcn Stepper form. Reskin only — validation rules, API endpoint
 * (`POST /api/guards`), OCR autofill behaviour, and photo upload contract
 * are unchanged.
 *
 * Steps:
 *   1. Personal Information
 *   2. Service Details
 *   3. Address & Contact
 *   4. Bank & Finance
 *   5. Documents
 *   6. Review & Submit
 *
 * The unified zod schema lives at `src/lib/schemas/guard-create.ts`.
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FormProvider, useForm, useFormContext, type Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  FileText,
  IdCard,
  Loader2,
  ShieldCheck,
} from "lucide-react"

import {
  guardCreateSchema,
  STEP_FIELDS,
  type GuardCreateForm,
} from "@/lib/schemas/guard-create"
import { calculateAgeYears } from "@/lib/validation/formats"
import {
  Stepper,
  type StepConfig,
} from "@/components/shadcn/stepper"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/form"
import { Input } from "@/components/shadcn/input"
import { Button } from "@/components/shadcn/button"
import { Switch } from "@/components/shadcn/switch"
import { Checkbox } from "@/components/shadcn/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shadcn/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog"
import ParwestAIAutofill from "@/components/ocr/ParwestAIAutofill"

// ────────────────────────────────────────────────────────────────────────────
// Types & constants
// ────────────────────────────────────────────────────────────────────────────

type RegionalOffice = {
  id: string
  name: string
  region: { id: string; name: string }
}

type Props = {
  regionalOffices: RegionalOffice[]
  currentUserName: string
  lockedRegionalOfficeId?: string | null
  lockedRegionId?: string | null
}

const STEPS: StepConfig[] = [
  { id: "personal", label: "Personal", meta: "Name, CNIC, DOB" },
  { id: "service", label: "Service", meta: "Office, supervisor, shift" },
  { id: "address", label: "Address", meta: "Permanent, current, contact" },
  { id: "bank", label: "Bank", meta: "Account & finance" },
  { id: "documents", label: "Documents", meta: "CNIC, photo, certificates" },
  { id: "review", label: "Review", meta: "Confirm & submit" },
]

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const
const MARITAL_STATUSES = [
  "single",
  "married",
  "divorced",
  "widowed",
  "separated",
  "engaged",
] as const
const RELIGIONS = ["Islam", "Christianity", "Hinduism", "Other"] as const
const EDUCATION_LEVELS = [
  "Primary",
  "Middle",
  "Matric",
  "Intermediate",
  "Graduate",
  "B.A",
  "BSc",
  "M.A",
  "Msc",
] as const
const SHIFTS = [
  { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" },
  { value: "ROTATING", label: "Rotating" },
] as const

// ────────────────────────────────────────────────────────────────────────────
// Main wizard
// ────────────────────────────────────────────────────────────────────────────

export default function GuardEnrollmentForm({
  regionalOffices,
  currentUserName,
  lockedRegionalOfficeId = null,
  lockedRegionId = null,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], [])

  const form = useForm<GuardCreateForm>({
    resolver: zodResolver(guardCreateSchema),
    mode: "onBlur",
    defaultValues: {
      // Personal
      name: "",
      fatherName: "",
      motherName: "",
      cnic: "",
      dateOfBirth: "",
      gender: "MALE",
      maritalStatus: "",
      religion: "Islam",
      bloodGroup: "",
      height: "",
      weight: "",
      identificationMark: "",
      education: "",
      passingYear: "",
      educationInstitute: "",
      isExService: false,
      exServiceType: "CIVILIAN",
      rank: "",
      unit: "",
      // Service
      regionalOfficeId: lockedRegionalOfficeId ?? "",
      regionId: lockedRegionId ?? "",
      supervisorId: "",
      managerName: "",
      designation: "Security Guard",
      shift: "DAY",
      joiningDate: todayIso,
      policeStation: "",
      nationality: "Pakistani",
      nextOfKin: "",
      // Address
      addressPermanent: "",
      permanentAddressContact: "",
      addressCurrent: "",
      currentAddressContact: "",
      phone: "",
      emergencyContactName: "",
      emergencyContactRelation: "",
      emergencyContactPhone: "",
      locationPin: "",
      // Bank
      bankName: "",
      accountNumber: "",
      accountTitle: "",
      branchLocation: "",
      iban: "",
      accountType: "CURRENT",
      salary: "",
      reservePct: 30,
      // Documents
      cnicCopyReceived: false,
      photoReceived: false,
      policeCertReceived: false,
      photoDataUrl: "",
    },
  })

  // Sync regionId when regionalOfficeId changes (server expects a regionId fallback)
  const watchedOffice = form.watch("regionalOfficeId")
  useEffect(() => {
    if (!watchedOffice) return
    const office = regionalOffices.find((o) => o.id === watchedOffice)
    if (office) {
      form.setValue("regionId", office.region.id, { shouldDirty: false })
    }
  }, [watchedOffice, regionalOffices, form])

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goNext = async () => {
    const fields = STEP_FIELDS[step]
    if (fields.length === 0) {
      // Review step has no fields — submit
      await onSubmit()
      return
    }
    const valid = await form.trigger(fields as readonly Path<GuardCreateForm>[])
    if (!valid) {
      // Focus first invalid field
      const firstError = fields.find((f) => form.getFieldState(f as Path<GuardCreateForm>).invalid)
      if (firstError) {
        form.setFocus(firstError as Path<GuardCreateForm>)
      }
      toast.error("Please fix the highlighted errors before continuing.")
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const goPrev = () => setStep((s) => Math.max(s - 1, 0))

  const goToStep = (i: number) => {
    if (i < step) setStep(i)
  }

  // ── Cancel / discard guard ─────────────────────────────────────────────────
  const handleCancelClick = () => {
    if (form.formState.isDirty) {
      setDiscardOpen(true)
    } else {
      router.push("/guards")
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async () => {
    // Validate the entire schema as a final safety net.
    const valid = await form.trigger()
    if (!valid) {
      toast.error("Please complete all required fields.")
      return
    }
    const values = form.getValues()
    setSubmitting(true)

    // Map RHF values → legacy API request shape.
    // The API parses bankAccounts JSON + the flat legacy fields.
    const bankAccounts = [
      {
        bankName: values.bankName,
        accountNumber: values.accountNumber,
        accountTitle: values.accountTitle,
        branchLocation: values.branchLocation,
        iban: values.iban || undefined,
        accountType: values.accountType,
        walletType: "BANK",
        isActive: true,
      },
    ]

    const ageYears = calculateAgeYears(values.dateOfBirth)

    const payload: Record<string, unknown> = {
      // Personal
      name: values.name,
      fatherName: values.fatherName,
      motherName: values.motherName,
      cnic: values.cnic,
      dateOfBirth: values.dateOfBirth,
      age: ageYears != null ? String(ageYears) : "",
      gender: values.gender,
      maritalStatus: values.maritalStatus,
      religion: values.religion,
      bloodGroup: values.bloodGroup,
      height: values.height,
      weight: values.weight,
      identificationMark: values.identificationMark,
      education: values.education,
      passingYear: values.passingYear,
      educationInstitute: values.educationInstitute,
      // Ex-service
      exServiceType: values.isExService ? values.exServiceType : "CIVILIAN",
      isExService: values.isExService ? "true" : "false",
      // Service
      regionalOfficeId: values.regionalOfficeId,
      regionId: values.regionId,
      supervisorId: values.supervisorId,
      managerName: values.managerName,
      designation: values.designation,
      shift: values.shift,
      joiningDate: values.joiningDate,
      policeStation: values.policeStation,
      nationality: values.nationality,
      nextOfKin: values.nextOfKin,
      // Address
      addressPermanent: values.addressPermanent,
      permanentAddressContact: values.permanentAddressContact,
      addressCurrent: values.addressCurrent,
      currentAddressContact: values.currentAddressContact,
      phone: values.phone,
      emergencyContact: values.emergencyContactPhone || values.emergencyContactName,
      // Bank
      bankAccounts: JSON.stringify(bankAccounts),
      salary: values.salary,
      reservePct: String(values.reservePct ?? 30),
      // Documents — boolean acks; actual files uploaded out-of-band
      cnicCopyReceived: values.cnicCopyReceived ? "true" : "false",
      photoReceived: values.photoReceived ? "true" : "false",
      policeCertReceived: values.policeCertReceived ? "true" : "false",
    }

    try {
      const res = await fetch("/api/guards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Per envelope contract: read `data.message`, NOT `data.error`.
        const msg =
          (data && typeof data === "object" && "message" in data && typeof data.message === "string"
            ? data.message
            : null) || "Failed to create guard."
        toast.error(msg)
        setSubmitting(false)
        return
      }
      const newId =
        (data && typeof data === "object" && "id" in data && typeof data.id === "string"
          ? data.id
          : null) ?? null
      const parwestId =
        (data && typeof data === "object" && "parwestId" in data && typeof data.parwestId === "string"
          ? data.parwestId
          : null) ?? "—"
      toast.success(`Guard created — Parwest ID: ${parwestId}`)
      // Reset dirty so the cancel-with-dirty guard doesn't fire on redirect.
      form.reset(values, { keepValues: true })
      if (newId) {
        router.push(`/guards/${newId}`)
      } else {
        router.push("/guards")
      }
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error."
      toast.error(msg)
      setSubmitting(false)
    }
  }

  // ── OCR autofill bridge ────────────────────────────────────────────────────
  // Legacy ParwestAIAutofill signature: `onApply: (fields: Record<string,string>) => void`.
  // We intentionally keep the legacy field names that the OCR pipeline emits
  // (e.g. `name`, `cnic`, `dateOfBirth`, `fatherName`, etc.) — they already
  // line up with our zod schema keys.
  const handleOcrApply = (fields: Record<string, string>) => {
    let appliedCount = 0
    Object.entries(fields).forEach(([key, value]) => {
      if (!value) return
      // Only apply keys we actually own in this schema; ignore unknowns.
      if (key in form.getValues()) {
        form.setValue(key as Path<GuardCreateForm>, value as never, {
          shouldDirty: true,
          shouldValidate: true,
        })
        appliedCount++
      }
    })
    if (appliedCount > 0) {
      toast.success(`Autofilled ${appliedCount} field${appliedCount === 1 ? "" : "s"} from CNIC`)
    } else {
      toast.warning("No matching fields to apply.")
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      {/* shadcn Form already injects a FormProvider; FormProvider explicit not required. */}
      <FormProvider {...form}>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            // Submission is driven by goNext on the last step
          }}
        >
          {/* Stepper */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4">
            <Stepper
              variant="horizontal"
              steps={STEPS}
              currentStep={step}
              onStepClick={goToStep}
            />
          </div>

          {/* OCR autofill — visible on the personal step only */}
          {step === 0 && (
            <div>
              <ParwestAIAutofill onApply={handleOcrApply} />
            </div>
          )}

          {/* Body */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-6">
            {step === 0 && <PersonalStep />}
            {step === 1 && (
              <ServiceStep
                regionalOffices={regionalOffices}
                lockedRegionalOfficeId={lockedRegionalOfficeId}
                currentUserName={currentUserName}
              />
            )}
            {step === 2 && <AddressStep />}
            {step === 3 && <BankStep />}
            {step === 4 && <DocumentsStep />}
            {step === 5 && <ReviewStep regionalOffices={regionalOffices} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancelClick}
              disabled={submitting}
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                Step {step + 1} / {STEPS.length}
              </span>
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goPrev}
                  disabled={submitting}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
              )}
              {step < STEPS.length - 1 && (
                <Button type="button" onClick={goNext} disabled={submitting}>
                  {step === STEPS.length - 2 ? "Review" : "Continue"}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
              {step === STEPS.length - 1 && (
                <Button type="button" onClick={onSubmit} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-4 w-4" />
                  )}
                  Create Guard
                </Button>
              )}
            </div>
          </div>
        </form>
      </FormProvider>

      {/* Discard confirmation */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard guard creation?</AlertDialogTitle>
            <AlertDialogDescription>
              Unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/guards")}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Step 1: Personal Information
// ────────────────────────────────────────────────────────────────────────────

function PersonalStep() {
  const form = useFormContext<GuardCreateForm>()
  const dob = form.watch("dateOfBirth")
  const ageYears = useMemo(() => (dob ? calculateAgeYears(dob) : null), [dob])
  const isExService = form.watch("isExService")

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Step 1 of 6
        </p>
        <h2 className="mt-1 text-xl font-bold text-[var(--text)]">
          Personal Information
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Core identity details. The CNIC is the primary unique identifier — double-check it.
        </p>
      </header>

      <section className="space-y-4">
        <SectionHeader icon={<IdCard className="h-4 w-4" />} title="Core Identity" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField name="name" label="Full Name" required placeholder="e.g. Muhammad Usman Khan" />
          <TextField name="fatherName" label="Father's Name" required placeholder="e.g. Khalid Mehmood Khan" />
          <TextField name="motherName" label="Mother's Name" required />
          <TextField
            name="cnic"
            label="CNIC"
            required
            placeholder="42201-1234567-9"
            description="Format: XXXXX-XXXXXXX-X"
          />
          <TextField
            name="dateOfBirth"
            label="Date of Birth"
            required
            type="date"
            description={ageYears != null ? `Age: ${ageYears} years` : undefined}
          />
          <SelectField
            name="gender"
            label="Gender"
            options={[
              { value: "MALE", label: "Male" },
              { value: "FEMALE", label: "Female" },
              { value: "OTHER", label: "Other" },
            ]}
          />
          <SelectField
            name="maritalStatus"
            label="Marital Status"
            required
            placeholder="Select…"
            options={MARITAL_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <SelectField
            name="religion"
            label="Religion"
            options={RELIGIONS.map((r) => ({ value: r, label: r }))}
          />
          <SelectField
            name="bloodGroup"
            label="Blood Group"
            required
            placeholder="Select…"
            options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
          />
          <TextField name="height" label="Height" placeholder={`e.g. 5'9"`} />
          <TextField name="weight" label="Weight" placeholder="e.g. 74 kg" />
          <TextField name="identificationMark" label="Identification Mark" placeholder="e.g. Mole on right cheek" />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader icon={<FileText className="h-4 w-4" />} title="Education" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SelectField
            name="education"
            label="Highest Qualification"
            placeholder="Select…"
            options={EDUCATION_LEVELS.map((e) => ({ value: e, label: e }))}
          />
          <TextField name="passingYear" label="Passing Year" placeholder="e.g. 2008" />
          <TextField name="educationInstitute" label="Board / Institute" placeholder="e.g. BISE Lahore" />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader icon={<ShieldCheck className="h-4 w-4" />} title="Ex-Service Details" hint="Optional" />

        <FormField
          control={form.control}
          name="isExService"
          render={({ field }) => (
            <FormItem className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1">
                <FormLabel className="text-sm font-semibold">
                  This guard is an ex-serviceman
                </FormLabel>
                <FormDescription>
                  Army, Navy, Air Force, Police, or Paramilitary
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {isExService && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SelectField
              name="exServiceType"
              label="Service Type"
              options={["ARMY", "NAVY", "AIR FORCE", "POLICE", "RANGERS", "FC"].map((t) => ({
                value: t,
                label: t,
              }))}
            />
            <TextField name="rank" label="Rank" placeholder="e.g. Lance Naik" />
            <TextField name="unit" label="Unit" placeholder="e.g. 22 Punjab" />
          </div>
        )}
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Step 2: Service Details
// ────────────────────────────────────────────────────────────────────────────

function ServiceStep({
  regionalOffices,
  lockedRegionalOfficeId,
  currentUserName,
}: {
  regionalOffices: RegionalOffice[]
  lockedRegionalOfficeId: string | null
  currentUserName: string
}) {
  const form = useFormContext<GuardCreateForm>()
  const officeId = form.watch("regionalOfficeId")

  // Supervisor list (loaded for the chosen office)
  const [supervisors, setSupervisors] = useState<
    Array<{ id: string; name: string; email: string }>
  >([])
  const [loadingSupers, setLoadingSupers] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!officeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dependent async-loaded list when RO changes
      setSupervisors([])
      return () => {
        cancelled = true
      }
    }
    setLoadingSupers(true)
    fetch(`/api/users?status=ACTIVE&regionalOfficeId=${officeId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ id: string; name: string; email: string }>) => {
        if (!cancelled) setSupervisors(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setSupervisors([])
      })
      .finally(() => {
        if (!cancelled) setLoadingSupers(false)
      })
    return () => {
      cancelled = true
    }
  }, [officeId])

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Step 2 of 6
        </p>
        <h2 className="mt-1 text-xl font-bold text-[var(--text)]">Service Details</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Designation, shift, and the regional office this guard is assigned to.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {lockedRegionalOfficeId ? (
          <FormItem>
            <FormLabel>
              Regional Office <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                readOnly
                value={(() => {
                  const o = regionalOffices.find((x) => x.id === lockedRegionalOfficeId)
                  return o ? `${o.name} (${o.region.name})` : "Locked office"
                })()}
                className="bg-[var(--surface-muted)]"
              />
            </FormControl>
            <FormDescription>Locked to your assigned regional office.</FormDescription>
          </FormItem>
        ) : (
          <SelectField
            name="regionalOfficeId"
            label="Regional Office"
            required
            placeholder="Select regional office"
            options={regionalOffices.map((o) => ({
              value: o.id,
              label: `${o.name} (${o.region.name})`,
            }))}
          />
        )}

        <FormField
          control={form.control}
          name="supervisorId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Supervisor <span className="text-destructive">*</span>
              </FormLabel>
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  const found = supervisors.find((s) => s.id === v)
                  if (found) form.setValue("managerName", found.name)
                }}
                disabled={!officeId || loadingSupers}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !officeId
                          ? "Select a regional office first"
                          : loadingSupers
                            ? "Loading supervisors…"
                            : "Select supervisor"
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {supervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <TextField name="designation" label="Designation" placeholder="Security Guard" />
        <SelectField
          name="shift"
          label="Shift"
          options={SHIFTS.map((s) => ({ value: s.value, label: s.label }))}
        />
        <TextField name="joiningDate" label="Joining Date" type="date" required />
        <TextField name="policeStation" label="Police Station" required />
        <TextField name="nationality" label="Nationality" required placeholder="e.g. Pakistani" />
        <TextField name="nextOfKin" label="Next of Kin" required />

        <FormItem className="md:col-span-2">
          <FormLabel>Enrolled By</FormLabel>
          <FormControl>
            <Input readOnly value={currentUserName} className="bg-[var(--surface-muted)]" />
          </FormControl>
        </FormItem>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Step 3: Address & Contact
// ────────────────────────────────────────────────────────────────────────────

function AddressStep() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Step 3 of 6
        </p>
        <h2 className="mt-1 text-xl font-bold text-[var(--text)]">Address & Contact</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Permanent and current residential addresses, contact numbers, and an emergency contact.
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Permanent Address</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            name="addressPermanent"
            label="Permanent Residential Address"
            required
            placeholder="House, street, city"
          />
          <TextField
            name="permanentAddressContact"
            label="Permanent Address Contact"
            required
            placeholder="+92-300-1234567"
            description="Format: +92-XXX-XXXXXXX"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Current Address</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            name="addressCurrent"
            label="Current Residential Address"
            required
            placeholder="House, street, city"
          />
          <TextField
            name="currentAddressContact"
            label="Current Address Contact"
            required
            placeholder="+92-300-1234567"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Primary Contact</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            name="phone"
            label="Mobile Number"
            required
            placeholder="+92-300-1234567"
            description="At least one contact number is required."
          />
          <TextField name="locationPin" label="Location Pin (lat,lng)" placeholder="optional" />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Emergency Contact</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TextField name="emergencyContactName" label="Name" />
          <TextField name="emergencyContactRelation" label="Relation" />
          <TextField
            name="emergencyContactPhone"
            label="Phone"
            placeholder="+92-300-1234567"
          />
        </div>
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Step 4: Bank & Finance
// ────────────────────────────────────────────────────────────────────────────

function BankStep() {
  const form = useFormContext<GuardCreateForm>()
  const salary = form.watch("salary")
  const reserve = form.watch("reservePct") ?? 0
  const reserveAmount = useMemo(() => {
    const s = Number(salary)
    if (!Number.isFinite(s)) return 0
    return Math.round((s * Number(reserve || 0)) / 100)
  }, [salary, reserve])

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Step 4 of 6
        </p>
        <h2 className="mt-1 text-xl font-bold text-[var(--text)]">Bank & Finance</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Primary bank account for salary disbursement and the reserve % held back each cycle.
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Primary Bank Account</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField name="bankName" label="Bank Name" required />
          <TextField name="accountTitle" label="Account Title" required />
          <TextField name="accountNumber" label="Account Number" required />
          <TextField name="iban" label="IBAN" placeholder="optional" />
          <TextField name="branchLocation" label="Branch Location" required />
          <SelectField
            name="accountType"
            label="Account Type"
            options={[
              { value: "CURRENT", label: "Current" },
              { value: "SAVINGS", label: "Savings" },
              { value: "OTHER", label: "Other" },
            ]}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Salary</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TextField
            name="salary"
            label="Basic Salary"
            required
            type="number"
            placeholder="40000"
          />
          <TextField
            name="reservePct"
            label="Reserve %"
            type="number"
            description="Held back per pay cycle."
          />
          <FormItem>
            <FormLabel>Reserve Amount</FormLabel>
            <FormControl>
              <div className="flex h-10 items-center rounded-md border border-input bg-[var(--surface-muted)] px-3 text-sm">
                <ParwestCurrency value={reserveAmount} />
              </div>
            </FormControl>
            <FormDescription>Auto-calculated from salary × reserve %.</FormDescription>
          </FormItem>
        </div>
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Step 5: Documents
// ────────────────────────────────────────────────────────────────────────────

function DocumentsStep() {
  const form = useFormContext<GuardCreateForm>()
  const photoDataUrl = form.watch("photoDataUrl")
  const name = form.watch("name")

  const initials = useMemo(() => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
  }, [name])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      form.setValue("photoDataUrl", dataUrl, { shouldDirty: true })
      form.setValue("photoReceived", true, { shouldDirty: true })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Step 5 of 6
        </p>
        <h2 className="mt-1 text-xl font-bold text-[var(--text)]">Documents</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Confirm which documents have been collected. Files are uploaded after the guard profile is created.
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Guard Photo</h3>
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {photoDataUrl ? (
              <AvatarImage src={photoDataUrl} alt="Guard photo preview" />
            ) : null}
            <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
            <Camera className="h-4 w-4" />
            {photoDataUrl ? "Replace photo" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">Document Checklist</h3>
        <CheckboxField
          name="cnicCopyReceived"
          label="CNIC Copy"
          description="Front + back required."
        />
        <CheckboxField
          name="photoReceived"
          label="Passport-size Photo"
          description="Auto-checked when you upload above."
        />
        <CheckboxField
          name="policeCertReceived"
          label="Police Verification Certificate"
        />
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Step 6: Review & Submit
// ────────────────────────────────────────────────────────────────────────────

function ReviewStep({ regionalOffices }: { regionalOffices: RegionalOffice[] }) {
  const form = useFormContext<GuardCreateForm>()
  const v = form.getValues()
  const office = regionalOffices.find((o) => o.id === v.regionalOfficeId)
  const ageYears = v.dateOfBirth ? calculateAgeYears(v.dateOfBirth) : null

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Step 6 of 6
        </p>
        <h2 className="mt-1 text-xl font-bold text-[var(--text)]">Review & Submit</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Double-check the details below. Submitting will create the guard profile.
        </p>
      </header>

      <ReviewSection title="Personal">
        <ReviewField label="Full Name" value={v.name} />
        <ReviewField label="Father's Name" value={v.fatherName} />
        <ReviewField label="Mother's Name" value={v.motherName} />
        <ReviewField label="CNIC" value={v.cnic} mono />
        <ReviewField
          label="Date of Birth"
          value={v.dateOfBirth ? `${v.dateOfBirth}${ageYears != null ? ` (age ${ageYears})` : ""}` : ""}
        />
        <ReviewField label="Gender" value={v.gender} />
        <ReviewField label="Marital Status" value={v.maritalStatus} />
        <ReviewField label="Religion" value={v.religion} />
        <ReviewField label="Blood Group" value={v.bloodGroup} />
        <ReviewField label="Ex-Service" value={v.isExService ? v.exServiceType : "Civilian"} />
      </ReviewSection>

      <ReviewSection title="Service">
        <ReviewField
          label="Regional Office"
          value={office ? `${office.name} (${office.region.name})` : v.regionalOfficeId}
        />
        <ReviewField label="Designation" value={v.designation} />
        <ReviewField label="Shift" value={v.shift} />
        <ReviewField label="Joining Date" value={v.joiningDate} />
        <ReviewField label="Police Station" value={v.policeStation} />
        <ReviewField label="Nationality" value={v.nationality} />
        <ReviewField label="Next of Kin" value={v.nextOfKin} />
      </ReviewSection>

      <ReviewSection title="Address & Contact">
        <ReviewField label="Permanent Address" value={v.addressPermanent} />
        <ReviewField label="Permanent Contact" value={v.permanentAddressContact} mono />
        <ReviewField label="Current Address" value={v.addressCurrent} />
        <ReviewField label="Current Contact" value={v.currentAddressContact} mono />
        <ReviewField label="Mobile" value={v.phone} mono />
        <ReviewField
          label="Emergency Contact"
          value={
            v.emergencyContactName
              ? `${v.emergencyContactName} (${v.emergencyContactRelation || "—"}) ${v.emergencyContactPhone}`
              : v.emergencyContactPhone || "—"
          }
        />
      </ReviewSection>

      <ReviewSection title="Bank & Finance">
        <ReviewField label="Bank Name" value={v.bankName} />
        <ReviewField label="Account Title" value={v.accountTitle} />
        <ReviewField label="Account Number" value={v.accountNumber} mono />
        <ReviewField label="IBAN" value={v.iban || "—"} mono />
        <ReviewField label="Branch" value={v.branchLocation} />
        <ReviewField label="Account Type" value={v.accountType} />
        <ReviewField
          label="Salary"
          value={v.salary ? <ParwestCurrency value={Number(v.salary)} /> : "—"}
        />
        <ReviewField label="Reserve %" value={`${v.reservePct ?? 0}%`} />
      </ReviewSection>

      <ReviewSection title="Documents">
        <ReviewField label="CNIC Copy" value={v.cnicCopyReceived ? "Received" : "Pending"} />
        <ReviewField label="Photo" value={v.photoReceived ? "Received" : "Pending"} />
        <ReviewField
          label="Police Certificate"
          value={v.policeCertReceived ? "Received" : "Pending"}
        />
      </ReviewSection>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
      {hint && (
        <span className="ml-auto text-xs text-[var(--text-muted)]">{hint}</span>
      )}
    </div>
  )
}

function TextField({
  name,
  label,
  required,
  type = "text",
  placeholder,
  description,
}: {
  name: Path<GuardCreateForm>
  label: string
  required?: boolean
  type?: string
  placeholder?: string
  description?: string
}) {
  const form = useFormContext<GuardCreateForm>()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label} {required ? <span className="text-destructive">*</span> : null}
          </FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              {...field}
              value={(field.value as string | number | undefined) ?? ""}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function SelectField({
  name,
  label,
  options,
  required,
  placeholder,
}: {
  name: Path<GuardCreateForm>
  label: string
  options: Array<{ value: string; label: string }>
  required?: boolean
  placeholder?: string
}) {
  const form = useFormContext<GuardCreateForm>()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label} {required ? <span className="text-destructive">*</span> : null}
          </FormLabel>
          <Select
            value={(field.value as string | undefined) ?? ""}
            onValueChange={field.onChange}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CheckboxField({
  name,
  label,
  description,
}: {
  name: Path<GuardCreateForm>
  label: string
  description?: string
}) {
  const form = useFormContext<GuardCreateForm>()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-white p-3">
          <FormControl>
            <Checkbox
              checked={Boolean(field.value)}
              onCheckedChange={(v) => field.onChange(Boolean(v))}
            />
          </FormControl>
          <div className="flex-1 space-y-0.5">
            <FormLabel className="cursor-pointer text-sm font-medium">{label}</FormLabel>
            {description ? <FormDescription>{description}</FormDescription> : null}
          </div>
        </FormItem>
      )}
    />
  )
}

function ReviewSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 md:grid-cols-3">
        {children}
      </div>
    </div>
  )
}

function ReviewField({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="border-b border-r border-[var(--border)] px-4 py-2 last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-medium text-[var(--text)] ${mono ? "font-mono" : ""}`}
      >
        {value || "—"}
      </p>
    </div>
  )
}
