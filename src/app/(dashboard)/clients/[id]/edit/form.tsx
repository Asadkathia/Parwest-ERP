/**
 * Parwest ERP — Client Edit Form (Phase 4B follow-up reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * RHF + zod + shadcn primitives. Reskin only — same fields, same validation
 * rules, same `PUT /api/clients/[id]` payload as the legacy form.
 *
 * Auxiliary widgets that are NOT migrated (legacy preserved):
 *   - <PhoneInput>     — uncontrolled +92-XXX-XXXXXXX formatter
 *   - <CnicInput>      — uncontrolled XXXXX-XXXXXXX-X formatter
 *   - <SearchSelect>   — searchable native select
 *   - <OcrUploadPanel> — OCR-driven autofill
 * They expose only `name` (no controlled value/onChange), so they're wrapped
 * in <FormControl> via a hidden RHF input bridge — same pattern Phase 3b's
 * guard form established for legacy widget integration.
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import type { FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ArrowLeft, Save, Plus, X } from "lucide-react"

import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"
import SearchSelect from "@/components/ui/SearchSelect"
import CnicInput from "@/components/ui/CnicInput"
import PhoneInput from "@/components/ui/PhoneInput"
import { isValidPhone } from "@/lib/validation/formats"
import { clientEditSchema, type ClientEditForm } from "@/lib/schemas/client"

import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import { Textarea } from "@/components/shadcn/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/shadcn/select"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/shadcn/form"
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

// ── Constants ───────────────────────────────────────────────────────────────

const PROVINCE_OPTIONS = [
    { value: "Punjab", label: "Punjab" },
    { value: "Sindh", label: "Sindh" },
    { value: "KPK", label: "KPK" },
    { value: "Balochistan", label: "Balochistan" },
    { value: "All Pakistan", label: "All Pakistan" },
]

// ── Types ────────────────────────────────────────────────────────────────────
type Client = {
    id: string
    name: string
    type: string
    email: string | null
    enrollmentDate: Date | string
    regionId: string | null
    regionalOfficeId: string | null
    city: string | null
    status: string
    isBranchless: boolean
    headOfficeAddress: string | null
    ntn: string | null
    strn: string | null
    contractUrl: string | null
    logoUrl: string | null
    contactPerson: string | null
    contactPersonDesignation: string | null
    phone: string | null
    contactNumbers: unknown
    postalCode: string | null
    introducerName: string | null
    introducerContactNumber: string | null
    introducerAddress: string | null
    introducerCnic: string | null
    operationalProvinces: string | null
    assignedManagerId: string | null
    reservePct: number | null
}

type Region = { id: string; name: string }

type Props = {
    client: Client
    regions: Region[]
    currentSupervisorId?: string | null
    isSuperAdmin?: boolean
    viewerRegionId?: string | null
    viewerRegionalOfficeId?: string | null
    activeBranches?: { id: string; name: string }[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d: Date | string | null | undefined): string {
    if (!d) return ""
    const date = typeof d === "string" ? new Date(d) : d
    return date.toISOString().slice(0, 10)
}

function initContactNumbers(raw: unknown): string[] {
    if (Array.isArray(raw) && (raw as string[]).length > 0) return raw as string[]
    // At least one visible (empty) row so the user has somewhere to type.
    // RHF is seeded separately with the stored numbers (or []) — never [""].
    return [""]
}

// ── Form ────────────────────────────────────────────────────────────────────
export default function ClientEditForm({
    client,
    regions,
    currentSupervisorId,
    isSuperAdmin = false,
    viewerRegionId = null,
    viewerRegionalOfficeId = null,
    activeBranches = [],
}: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const isRegionalViewer = !isSuperAdmin && Boolean(viewerRegionId)
    const lockedRegionalOffice = isRegionalViewer ? viewerRegionalOfficeId : null
    const [submitting, setSubmitting] = useState(false)
    const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)

    // Auxiliary cascading data
    const [regionalOffices, setRegionalOffices] = useState<{ id: string; name: string }[]>([])
    const [managerUsers, setManagerUsers] = useState<{ id: string; name: string }[]>([])
    const [supervisorUsers, setSupervisorUsers] = useState<{ id: string; name: string }[]>([])
    const [clientTypes, setClientTypes] = useState<{ value: string; label: string }[]>([])

    // Reserve % is stored as decimal (0..1) in DB; edited as % (0..100) in UI
    const initialReservePct =
        client.reservePct != null ? String(Math.round(client.reservePct * 10000) / 100) : ""

    // Multi-contact numbers (legacy contactNumbers JSON column)
    const [contactNumbers, setContactNumbers] = useState<string[]>(initContactNumbers(client.contactNumbers))

    // Mode toggle (Branch / Branchless) — kept as form field but rendered as button group
    const form = useForm<ClientEditForm>({
        resolver: zodResolver(clientEditSchema),
        mode: "onBlur",
        defaultValues: {
            name: client.name ?? "",
            type: client.type ?? "",
            email: client.email ?? "",
            enrollmentDate: fmtDate(client.enrollmentDate),
            isBranchless: client.isBranchless,
            status:
                client.status === "BLACKLISTED" ? "BLACKLISTED" :
                client.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",

            contactPerson: client.contactPerson ?? "",
            contactPersonDesignation: client.contactPersonDesignation ?? "",
            // RHF source of truth: the client's stored numbers, or [] — never [""].
            // The visible multi-input UI is kept in `contactNumbers` local state
            // and synced into this field on every mutation (see updateContactNumbers).
            contactNumbers: Array.isArray(client.contactNumbers)
                ? (client.contactNumbers as string[]).filter((n) => typeof n === "string" && n.trim())
                : [],
            clientLocation: client.city ?? "",
            clientPostalCode: client.postalCode ?? "",
            headOfficeAddress: client.headOfficeAddress ?? "",

            introducerName: client.introducerName ?? "",
            introducerContactNumber: client.introducerContactNumber ?? "",
            introducerAddress: client.introducerAddress ?? "",
            introducerCnicNumber: client.introducerCnic ?? "",

            operationalProvinces: client.operationalProvinces ?? "",

            regionId: isRegionalViewer ? (viewerRegionId ?? "") : (client.regionId ?? ""),
            regionalOfficeId: lockedRegionalOffice ?? (client.regionalOfficeId ?? ""),
            assignedManagerId: client.assignedManagerId ?? "",
            assignedSupervisorId: currentSupervisorId ?? "",

            ntn: client.ntn ?? "",
            strn: client.strn ?? "",
            logoUrl: client.logoUrl ?? "",
            reservePctInput: initialReservePct,
        },
    })

    // Keep the visible multi-input UI and RHF in lockstep: every add/remove/edit
    // of a contact-number row updates both local state and the validated RHF field,
    // so the value zod sees always matches what the user sees.
    const updateContactNumbers = (next: string[]) => {
        setContactNumbers(next)
        form.setValue("contactNumbers", next, { shouldDirty: true, shouldValidate: true })
    }

    const watchedRegionId = useWatch({ control: form.control, name: "regionId" })
    const isBranchless = useWatch({ control: form.control, name: "isBranchless" }) ?? true

    // Derive: city always mirrors the selected region's name.
    // Only write when the value actually changes, and never mark the form dirty
    // on mount — otherwise the discard guard and save gate fire spuriously.
    useEffect(() => {
        const regionName = regions.find((r) => r.id === watchedRegionId)?.name ?? ""
        if (form.getValues("clientLocation") !== regionName) {
            form.setValue("clientLocation", regionName, { shouldDirty: false })
        }
    }, [watchedRegionId, regions, form])

    // Cascade: regional offices
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dependent async-loaded list when region changes
        setRegionalOffices([])
        if (!watchedRegionId) return
        fetch(`/api/regional-offices?regionId=${watchedRegionId}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setRegionalOffices(
                        (data as { id: string; name: string }[]).map((o) => ({ id: o.id, name: o.name })),
                    )
                }
            })
            .catch(() => {})
    }, [watchedRegionId])

    // Cascade: managers + supervisors
    useEffect(() => {
        const url = watchedRegionId
            ? `/api/users?limit=500&regionId=${watchedRegionId}`
            : "/api/users?limit=500"
        fetch(url)
            .then((r) => (r.ok ? r.json() : []))
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    const users = data as { id: string; name?: string | null; role?: { name?: string | null } }[]
                    const toOption = (u: typeof users[0]) => ({ id: u.id, name: u.name as string })
                    setManagerUsers(
                        users.filter((u) => u.name && u.role?.name?.toLowerCase() === "manager").map(toOption),
                    )
                    setSupervisorUsers(
                        users.filter((u) => u.name && u.role?.name?.toLowerCase() === "supervisor").map(toOption),
                    )
                }
            })
            .catch(() => {})
    }, [watchedRegionId])

    // Lookup catalogs
    useEffect(() => {
        fetch("/api/client-types")
            .then((r) => (r.ok ? r.json() : []))
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setClientTypes(
                        (data as { name: string; label: string }[]).map((t) => ({ value: t.name, label: t.label })),
                    )
                }
            })
            .catch(() => {})
    }, [])

    // OCR autofill — bridges legacy form-field-name based panel into RHF setValue.
    const applyOcrFields = (fields: Record<string, string>) => {
        const formEl = formRef.current
        if (!formEl) return
        Object.entries(fields).forEach(([name, value]) => {
            // Push into RHF if we own the field; otherwise fall back to DOM input.
            if (name in form.getValues()) {
                form.setValue(name as keyof ClientEditForm, value as never, {
                    shouldDirty: true,
                    shouldValidate: true,
                })
            } else {
                const el = formEl.elements.namedItem(name) as
                    | HTMLInputElement
                    | HTMLTextAreaElement
                    | HTMLSelectElement
                    | null
                if (el) el.value = value
            }
        })
    }

    // Submit
    const onSubmit = async (values: ClientEditForm) => {
        // Pre-flight: matches the server-side workflow rule
        // `branches.requireInactiveBranchesBeforeClientInactive` (Ticket 33).
        // The server also enforces this; the client check just gives a better UX.
        if (values.status === "INACTIVE" && activeBranches.length > 0) {
            toast.error(
                `Cannot deactivate client with ${activeBranches.length} active branch${activeBranches.length === 1 ? "" : "es"}. Deactivate them first.`
            )
            return
        }
        // Multi-contact phone format check (mirrors legacy). RHF is the source
        // of truth and is kept in sync with the visible inputs.
        const filled = (values.contactNumbers ?? []).map((n) => n.trim()).filter(Boolean)
        for (const num of filled) {
            if (!isValidPhone(num)) {
                toast.error(`Contact number "${num}" must be in format +92-XXX-XXXXXXX.`)
                return
            }
        }

        // Reserve % decimal conversion
        let reservePctDecimal: number | null = null
        const rpTrim = (values.reservePctInput ?? "").trim()
        if (rpTrim !== "") {
            const pct = parseFloat(rpTrim)
            // (zod refine already validated range, but stay defensive)
            if (!Number.isNaN(pct) && pct >= 0 && pct <= 100) {
                reservePctDecimal = Math.round((pct / 100) * 10000) / 10000
            }
        }

        setSubmitting(true)
        try {
            const payload = {
                ...values,
                isBranchless: values.isBranchless,
                contactNumber: filled[0] ?? "",
                contactNumbers: filled,
                regionId: values.regionId || null,
                regionalOfficeId: values.regionalOfficeId || null,
                reservePct: reservePctDecimal,
            }

            const response = await fetch(`/api/clients/${client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                const msg =
                    (data && typeof data === "object" && "message" in data && typeof data.message === "string"
                        ? data.message
                        : null) || "Failed to update client"
                toast.error(msg)
                setSubmitting(false)
                return
            }

            toast.success("Client updated")
            // Reset dirty so the discard guard doesn't trigger after redirect
            form.reset(values, { keepValues: true })
            router.push(`/clients/${client.id}`)
            router.refresh()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unexpected error"
            toast.error(msg)
            setSubmitting(false)
        }
    }

    // Surface zod validation failures so the Save button never appears inert.
    const onInvalid = (errors: FieldErrors<ClientEditForm>) => {
        const firstMessage = Object.values(errors).flatMap((e) => {
            if (!e) return []
            if (typeof e === "object" && "message" in e && typeof e.message === "string") return [e.message]
            return []
        })[0]
        toast.error(firstMessage ?? "Please fix the highlighted fields and try again.")
        console.warn("Client edit form validation errors", errors)
    }

    const handleCancel = () => {
        if (form.formState.isDirty) {
            setConfirmDiscardOpen(true)
            return
        }
        router.push("/clients")
    }

    return (
        <Form {...form}>
            <form
                ref={formRef}
                onSubmit={form.handleSubmit(onSubmit, onInvalid)}
                className="space-y-6"
            >
                <Card>
                    <CardContent className="pt-6">
                        <OcrUploadPanel target="client" onApply={applyOcrFields} />
                    </CardContent>
                </Card>

                {/* Basic Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Client&apos;s Name <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter client name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Client Type <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            {/* Legacy SearchSelect bridged via name + defaultValue */}
                                            <div>
                                                <SearchSelect
                                                    name="type"
                                                    options={clientTypes}
                                                    defaultValue={field.value || ""}
                                                    placeholder={
                                                        clientTypes.length === 0 ? "Loading types…" : "Select client type"
                                                    }
                                                    onChange={(v) => field.onChange(v)}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Client&apos;s Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="Client's Email"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="enrollmentDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Enrollment Date</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                readOnly={!isSuperAdmin}
                                                className={!isSuperAdmin ? "bg-[var(--surface-muted)] cursor-not-allowed" : ""}
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        {!isSuperAdmin && (
                                            <FormDescription>
                                                Only Super Admin can change the enrollment date.
                                            </FormDescription>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => {
                                    const blockingInactive =
                                        field.value === "INACTIVE" && activeBranches.length > 0
                                    return (
                                        <FormItem>
                                            <FormLabel>Status</FormLabel>
                                            <Select
                                                value={field.value ?? "ACTIVE"}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                                    <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {blockingInactive ? (
                                                <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                                                    <p>
                                                        This client has {activeBranches.length} active
                                                        branch{activeBranches.length === 1 ? "" : "es"}.
                                                        Deactivate all branches before setting the client
                                                        to inactive:
                                                    </p>
                                                    <ul className="mt-1 list-disc pl-5">
                                                        {activeBranches.slice(0, 8).map((b) => (
                                                            <li key={b.id}>
                                                                <a
                                                                    href={`/clients/branches/${b.id}/edit`}
                                                                    className="underline font-medium"
                                                                >
                                                                    {b.name}
                                                                </a>
                                                            </li>
                                                        ))}
                                                        {activeBranches.length > 8 ? (
                                                            <li>
                                                                …and {activeBranches.length - 8} more
                                                            </li>
                                                        ) : null}
                                                    </ul>
                                                </div>
                                            ) : null}
                                            <FormMessage />
                                        </FormItem>
                                    )
                                }}
                            />

                            <FormField
                                control={form.control}
                                name="isBranchless"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Client Add Mode</FormLabel>
                                        <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => field.onChange(false)}
                                                className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                    !field.value
                                                        ? "bg-[var(--brand)] text-white"
                                                        : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]"
                                                }`}
                                            >
                                                Branch Client
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => field.onChange(true)}
                                                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-[var(--border)] ${
                                                    field.value
                                                        ? "bg-[var(--brand)] text-white"
                                                        : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]"
                                                }`}
                                            >
                                                Branchless Client
                                            </button>
                                        </div>
                                        {/* Reference watched value to satisfy lint when not used elsewhere */}
                                        <span className="sr-only">{isBranchless ? "branchless" : "branch"}</span>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="contactPerson"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Person</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Contact person" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="contactPersonDesignation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Person Designation</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g., Manager, Director, Officer"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div>
                                <Label>Contact Number</Label>
                                <div className="space-y-2">
                                    {contactNumbers.map((num, idx) => {
                                        const invalid = num.trim().length > 0 && !isValidPhone(num.trim())
                                        return (
                                            <div key={idx} className="flex items-start gap-2">
                                                <div className="flex-1">
                                                    <Input
                                                        type="text"
                                                        value={num}
                                                        onChange={(e) => {
                                                            const updated = [...contactNumbers]
                                                            updated[idx] = e.target.value
                                                            updateContactNumbers(updated)
                                                        }}
                                                        className={invalid ? "border-destructive" : ""}
                                                        placeholder={
                                                            idx === 0 ? "+92-300-1234567" : `Contact number ${idx + 1}`
                                                        }
                                                    />
                                                    {invalid && (
                                                        <p className="mt-1 text-[11px] text-destructive">
                                                            Format must be +92-300-1234567
                                                        </p>
                                                    )}
                                                </div>
                                                {contactNumbers.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateContactNumbers(contactNumbers.filter((_, i) => i !== idx))
                                                        }
                                                        className="flex-shrink-0 mt-2 text-[var(--text-muted)] hover:text-destructive"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => updateContactNumbers([...contactNumbers, ""])}
                                        className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline mt-1"
                                    >
                                        <Plus size={13} /> Add another number
                                    </button>
                                </div>
                            </div>

                            <FormField
                                control={form.control}
                                name="clientLocation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>City (follows region)</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                value={field.value ?? ""}
                                                readOnly
                                                disabled
                                                placeholder="Set by selecting a region"
                                                className="bg-[var(--surface-muted)] cursor-not-allowed"
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Derived automatically from the selected region.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="clientPostalCode"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Client&apos;s Postal Code</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Postal code" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="headOfficeAddress"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Head Office Address</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                rows={2}
                                                placeholder="Head Office Address"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Introducer/Referral */}
                <Card>
                    <CardHeader>
                        <CardTitle>Introducer / Referral</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="introducerName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Name" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="introducerContactNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Number</FormLabel>
                                        <FormControl>
                                            {/* Bridge legacy PhoneInput: it owns its own DOM input via `name`,
                                                we shadow-bridge the value into RHF on change. */}
                                            <div
                                                onBlur={(e) => {
                                                    const target = (e.target as HTMLInputElement)
                                                    if (target?.name === "introducerContactNumber") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                                onChangeCapture={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "introducerContactNumber") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                            >
                                                <PhoneInput
                                                    name="introducerContactNumber"
                                                    defaultValue={field.value ?? ""}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="introducerAddress"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Address</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Address" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="introducerCnicNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CNIC Number</FormLabel>
                                        <FormControl>
                                            <div
                                                onBlur={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "introducerCnicNumber") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                                onChangeCapture={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "introducerCnicNumber") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                            >
                                                <CnicInput
                                                    name="introducerCnicNumber"
                                                    defaultValue={field.value ?? ""}
                                                    placeholder="CNIC number"
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Operational Territory */}
                <Card>
                    <CardHeader>
                        <CardTitle>Operational Territory</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FormField
                            control={form.control}
                            name="operationalProvinces"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Operational Provinces</FormLabel>
                                    <FormControl>
                                        <div>
                                            <SearchSelect
                                                name="operationalProvinces"
                                                options={PROVINCE_OPTIONS}
                                                defaultValue={field.value || ""}
                                                placeholder="Select Operational Territory"
                                                onChange={(v) => field.onChange(v)}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Region & Assignment */}
                <Card>
                    <CardHeader>
                        <CardTitle>Region &amp; Assignment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="regionId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Region</FormLabel>
                                        <Select
                                            value={field.value ?? ""}
                                            onValueChange={(v) => {
                                                field.onChange(v)
                                                form.setValue("regionalOfficeId", "", { shouldDirty: true })
                                            }}
                                            disabled={isRegionalViewer}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="— Select Region —" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {regions.map((r) => (
                                                    <SelectItem key={r.id} value={r.id}>
                                                        {r.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {isRegionalViewer && (
                                            <FormDescription>Locked to your assigned region.</FormDescription>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="regionalOfficeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Regional Office</FormLabel>
                                        <Select
                                            value={field.value ?? ""}
                                            onValueChange={field.onChange}
                                            disabled={!watchedRegionId || Boolean(lockedRegionalOffice)}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue
                                                        placeholder={
                                                            !watchedRegionId
                                                                ? "— Select Region First —"
                                                                : regionalOffices.length === 0
                                                                  ? "No offices in this region"
                                                                  : "— Select Regional Office —"
                                                        }
                                                    />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {regionalOffices.map((o) => (
                                                    <SelectItem key={o.id} value={o.id}>
                                                        {o.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {lockedRegionalOffice && (
                                            <FormDescription>
                                                Locked to your assigned regional office.
                                            </FormDescription>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="assignedManagerId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Assigned Manager</FormLabel>
                                        <FormControl>
                                            <div>
                                                <SearchSelect
                                                    name="assignedManagerId"
                                                    options={managerUsers.map((u) => ({ value: u.id, label: u.name }))}
                                                    defaultValue={field.value || ""}
                                                    placeholder={
                                                        watchedRegionId ? "— Select Manager —" : "— Select Region First —"
                                                    }
                                                    onChange={(v) => field.onChange(v)}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="assignedSupervisorId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Assigned Supervisor</FormLabel>
                                        <FormControl>
                                            <div>
                                                <SearchSelect
                                                    name="assignedSupervisorId"
                                                    options={supervisorUsers.map((u) => ({
                                                        value: u.id,
                                                        label: u.name,
                                                    }))}
                                                    defaultValue={field.value || ""}
                                                    placeholder={
                                                        watchedRegionId
                                                            ? "— Select Supervisor —"
                                                            : "— Select Region First —"
                                                    }
                                                    onChange={(v) => field.onChange(v)}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Tax & Legal */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tax &amp; Legal</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="ntn"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>NTN (National Tax Number)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter NTN" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="strn"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>STRN (Sales Tax Registration)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter STRN" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="logoUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Logo URL</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="url"
                                                placeholder="https://example.com/logo.png"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="reservePctInput"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reserve Salary % (override)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step="0.01"
                                                placeholder="e.g. 30"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Optional. % of net pay withheld monthly as reserve balance. Leave blank to
                                            use the regional office or global default (30%).
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Form Actions */}
                <div className="flex items-center gap-3">
                    <Button type="button" variant="ghost" onClick={handleCancel} disabled={submitting}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Cancel
                    </Button>
                    <PermissionGate module="CLIENTS" action="UPDATE" mode="disable">
                        <Button
                            type="submit"
                            disabled={submitting || !form.formState.isDirty}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {submitting ? "Saving…" : "Save Changes"}
                        </Button>
                    </PermissionGate>
                </div>
            </form>

            {/* Discard confirmation */}
            <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Unsaved changes will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction onClick={() => router.push("/clients")}>
                            Discard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Form>
    )
}
