/**
 * Parwest ERP — Client Create Form (Phase 4B follow-up reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * RHF + zod + shadcn primitives for the *client-level* fields. Reskin only —
 * same fields, same validation rules, same `POST /api/clients` payload as
 * the legacy form.
 *
 * NOT migrated (kept as legacy uncontrolled state per "NOT branches" rule):
 *   - Default-branch wizard (capacity matrix, branch contact info, etc.)
 *   - Contract PDF + extra attachments upload
 *   - OCR autofill (legacy `OcrUploadPanel`)
 *   - Legacy widgets: <PhoneInput>, <CnicInput>, <SearchSelect>,
 *     <LocationPickerMap>
 *
 * Legacy-widget bridge: the same pattern Phase 3b's guard form established
 * for CnicInput — wrap in <FormControl> and bubble onChange via capture.
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import type { FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
    ArrowLeft,
    Save,
    Plus,
    X,
    Upload,
    CheckCircle2,
    ExternalLink,
    Paperclip,
} from "lucide-react"
import Link from "next/link"

import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"
import SearchSelect from "@/components/ui/SearchSelect"
import LocationPickerMap from "@/components/ui/LocationPickerMap"
import CnicInput from "@/components/ui/CnicInput"
import PhoneInput from "@/components/ui/PhoneInput"
import { isValidCnic, isValidPhone } from "@/lib/validation/formats"
import { clientCreateSchema, type ClientCreateForm } from "@/lib/schemas/client"

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

// ── Constants ───────────────────────────────────────────────────────────────

const PROVINCE_OPTIONS = [
    { value: "Punjab", label: "Punjab" },
    { value: "Sindh", label: "Sindh" },
    { value: "KPK", label: "KPK" },
    { value: "Balochistan", label: "Balochistan" },
    { value: "All Pakistan", label: "All Pakistan" },
]

type Region = { id: string; name: string }

type Props = {
    regions: Region[]
    initialBranchless?: boolean
    isSuperAdmin?: boolean
    viewerRegionId?: string | null
    viewerRegionalOfficeId?: string | null
}

function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(file)
    })
}

// Mirrors the formatter inside <PhoneInput>. We can't reuse that uncontrolled
// component for the contactNumbers[] array (no onChange), so we inline the
// same +92-XXX-XXXXXXX formatting on this controlled input.
const PHONE_PREFIX = "+92-"
const PHONE_MAX_DIGITS = 10
function formatPhoneDigits(raw: string): string {
    let afterPrefix: string
    if (raw.startsWith(PHONE_PREFIX)) {
        afterPrefix = raw.slice(PHONE_PREFIX.length).replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS)
    } else {
        const allDigits = raw.replace(/\D/g, "")
        const stripped =
            allDigits.startsWith("92") && allDigits.length > PHONE_MAX_DIGITS
                ? allDigits.slice(2)
                : allDigits
        afterPrefix = stripped.slice(0, PHONE_MAX_DIGITS)
    }
    if (afterPrefix.length === 0) return raw === "" ? "" : PHONE_PREFIX
    if (afterPrefix.length <= 3) return PHONE_PREFIX + afterPrefix
    return `${PHONE_PREFIX}${afterPrefix.slice(0, 3)}-${afterPrefix.slice(3)}`
}

export default function ClientEnrollmentForm({
    regions,
    initialBranchless = true,
    isSuperAdmin = false,
    viewerRegionId = null,
    viewerRegionalOfficeId = null,
}: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const isRegionalViewer = !isSuperAdmin && Boolean(viewerRegionId)
    const lockedRegionalOffice = isRegionalViewer ? viewerRegionalOfficeId : null
    const todayIso = new Date().toISOString().slice(0, 10)

    const [submitting, setSubmitting] = useState(false)
    const [savedClient, setSavedClient] =
        useState<{ id: string; name: string; branchCreated: boolean } | null>(null)

    // ── RHF (client-level fields) ─────────────────────────────────────────────
    const form = useForm<ClientCreateForm>({
        resolver: zodResolver(clientCreateSchema),
        mode: "onBlur",
        defaultValues: {
            name: "",
            type: "",
            email: "",
            isBranchless: initialBranchless,
            enrollmentDate: todayIso,

            contactPerson: "",
            contactPersonDesignation: "",
            contactNumber: "",
            contactNumbers: [],
            clientLocation: "",
            clientPostalCode: "",
            headOfficeAddress: "",

            introducerName: "",
            introducerContactNumber: "",
            introducerAddress: "",
            introducerCnicNumber: "",

            operationalProvinces: "",

            regionId: isRegionalViewer ? (viewerRegionId ?? "") : "",
            regionalOfficeId: lockedRegionalOffice ?? "",
            assignedManagerId: "",
            assignedSupervisorId: "",

            ntn: "",
            strn: "",

            status: "ACTIVE",

            // Contracts are managed via the Pricing panel now; only the uploaded
            // contract document URL remains on the client.
            contractUrl: "",
        },
    })

    const watchedRegionId = useWatch({ control: form.control, name: "regionId" })
    const isBranchless = useWatch({ control: form.control, name: "isBranchless" }) ?? initialBranchless
    const watchedProvince = useWatch({ control: form.control, name: "operationalProvinces" })

    // ── Auxiliary state (NOT migrated to RHF — branches/attachments scope) ────
    const [contactNumbers, setContactNumbers] = useState<string[]>([""])
    const [supervisorUsers, setSupervisorUsers] = useState<{ id: string; name: string }[]>([])
    const [managerUsers, setManagerUsers] = useState<{ id: string; name: string }[]>([])
    const [regionalOffices, setRegionalOffices] = useState<{ id: string; name: string }[]>([])
    const [clientTypes, setClientTypes] = useState<{ value: string; label: string }[]>([])

    // Default branch state (rendered when isBranchless=true; NOT in scope for migration)
    const [defaultBranchName, setDefaultBranchName] = useState("")
    const [, setLatManual] = useState("")
    const [, setLngManual] = useState("")

    // Branch-mode state (rendered when isBranchless=false — out of scope per brief)
    const [branchRegionId, setBranchRegionId] = useState(isRegionalViewer ? (viewerRegionId ?? "") : "")
    const [branchRegionalOfficeId, setBranchRegionalOfficeId] = useState(lockedRegionalOffice ?? "")
    const [branchRegionalOffices, setBranchRegionalOffices] = useState<{ id: string; name: string }[]>([])
    const [branchManagerUsers, setBranchManagerUsers] = useState<{ id: string; name: string }[]>([])
    const [branchSupervisorUsers, setBranchSupervisorUsers] = useState<{ id: string; name: string }[]>([])
    const [branchIsLockerBranch, setBranchIsLockerBranch] = useState<"yes" | "no">("no")
    const [branchContactPhones, setBranchContactPhones] = useState<string[]>([""])
    const [branchOperationsManagerId, setBranchOperationsManagerId] = useState("")
    const [branchLatManual, setBranchLatManual] = useState("")
    const [branchLngManual, setBranchLngManual] = useState("")

    // Contract upload + attachments
    const [contractFile, setContractFile] = useState<string | null>(null)
    const [contractFileName, setContractFileName] = useState("")
    const [attachments, setAttachments] = useState<{ name: string; dataUrl: string }[]>([])
    const attachFileRef = useRef<HTMLInputElement>(null)

    // ── Lookup catalogs (load once) ───────────────────────────────────────────
    useEffect(() => {
        fetch("/api/client-types")
            .then((r) => (r.ok ? r.json() : []))
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setClientTypes(
                        (data as { name: string; label: string }[]).map((t) => ({
                            value: t.name,
                            label: t.label,
                        })),
                    )
                }
            })
            .catch(() => {})
    }, [])

    // ── Derive: client city always mirrors region name ─────────────────────────
    // Only write when the value actually changes, and never mark the form dirty
    // on mount — otherwise dirty-based gating fires spuriously.
    useEffect(() => {
        const regionName = regions.find((r) => r.id === watchedRegionId)?.name ?? ""
        if (form.getValues("clientLocation") !== regionName) {
            form.setValue("clientLocation", regionName, { shouldDirty: false })
        }
    }, [watchedRegionId, regions, form])

    // ── Cascade: client-level region → regional offices + managers ────────────
    useEffect(() => {
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

    useEffect(() => {
        const url = watchedRegionId
            ? `/api/users?limit=500&regionId=${watchedRegionId}`
            : "/api/users?limit=500"
        fetch(url)
            .then((r) => (r.ok ? r.json() : []))
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    const users = data as {
                        id: string
                        name?: string | null
                        role?: { name?: string | null }
                    }[]
                    const toOption = (u: typeof users[0]) => ({ id: u.id, name: u.name as string })
                    setSupervisorUsers(
                        users.filter((u) => u.name && u.role?.name?.toLowerCase() === "supervisor").map(toOption),
                    )
                    setManagerUsers(
                        users.filter((u) => u.name && u.role?.name?.toLowerCase() === "manager").map(toOption),
                    )
                }
            })
            .catch(() => {})
    }, [watchedRegionId])

    // ── Cascade: branch-level region (auxiliary, branch wizard) ──────────────
    useEffect(() => {
        setBranchRegionalOfficeId("")
        setBranchRegionalOffices([])
        if (!branchRegionId) return
        fetch(`/api/regional-offices?regionId=${branchRegionId}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setBranchRegionalOffices(
                        (data as { id: string; name: string }[]).map((o) => ({
                            id: o.id,
                            name: o.name,
                        })),
                    )
                }
            })
            .catch(() => {})
    }, [branchRegionId])

    useEffect(() => {
        const url = branchRegionId
            ? `/api/users?limit=500&regionId=${branchRegionId}`
            : "/api/users?limit=500"
        fetch(url)
            .then((r) => (r.ok ? r.json() : []))
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    const users = data as {
                        id: string
                        name?: string | null
                        role?: { name?: string | null }
                    }[]
                    const toOption = (u: typeof users[0]) => ({ id: u.id, name: u.name as string })
                    setBranchManagerUsers(
                        users.filter((u) => u.name && u.role?.name?.toLowerCase() === "manager").map(toOption),
                    )
                    setBranchSupervisorUsers(
                        users.filter((u) => u.name && u.role?.name?.toLowerCase() === "supervisor").map(toOption),
                    )
                }
            })
            .catch(() => {})
    }, [branchRegionId])

    // ── Derive: branch city always mirrors branch region name ─────────────────
    const [branchCityDerived, setBranchCityDerived] = useState(
        isRegionalViewer && viewerRegionId
            ? (regions.find((r) => r.id === viewerRegionId)?.name ?? "")
            : "",
    )
    useEffect(() => {
        const regionName = regions.find((r) => r.id === branchRegionId)?.name ?? ""
        setBranchCityDerived(regionName)
    }, [branchRegionId, regions])

    // ── OCR + attachment helpers ──────────────────────────────────────────────
    const applyOcrFields = (fields: Record<string, string>) => {
        const formEl = formRef.current
        if (!formEl) return
        Object.entries(fields).forEach(([name, value]) => {
            if (name in form.getValues()) {
                form.setValue(name as keyof ClientCreateForm, value as never, {
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

    const handleAttachmentAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        files.forEach((file) => {
            const reader = new FileReader()
            reader.onload = () =>
                setAttachments((prev) => [...prev, { name: file.name, dataUrl: reader.result as string }])
            reader.readAsDataURL(file)
        })
        if (attachFileRef.current) attachFileRef.current.value = ""
    }

    const removeAttachment = (idx: number) =>
        setAttachments((prev) => prev.filter((_, i) => i !== idx))

    const handleContractFile = async (file: File | null) => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Contract file must be under 5 MB")
            return
        }
        const base64 = await readFileAsBase64(file)
        setContractFile(base64)
        setContractFileName(file.name)
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    const onSubmit = async (values: ClientCreateForm) => {
        const filled = contactNumbers.filter((n) => n.trim())
        const branchFilled = branchContactPhones.filter((n) => n.trim())

        // Pull the auxiliary FormData (legacy widgets without RHF state).
        const formData = formRef.current ? new FormData(formRef.current) : new FormData()

        // CNIC validation (branch CNIC is auxiliary; introducer CNIC handled by zod)
        const branchCnic = String(formData.get("branchContactPersonCnic") ?? "").trim()
        if (branchCnic && !isValidCnic(branchCnic)) {
            toast.error("Branch Contact Person CNIC format is invalid. Expected XXXXX-XXXXXXX-X.")
            return
        }

        // Phone validation — auxiliary (branch) widgets that aren't in zod
        const normalizePhone = (raw: string) => {
            const v = raw.trim()
            return v === "+92-" ? "" : v
        }
        const auxPhoneFields: [string, string][] = [
            ["Branch Manager Contact", normalizePhone(String(formData.get("branchManagerContact") ?? ""))],
            [
                "Branch Operations Manager Contact",
                normalizePhone(String(formData.get("branchOperationsManagerContact") ?? "")),
            ],
            [
                "Branch Supervisor Contact",
                normalizePhone(String(formData.get("branchSupervisorContact") ?? "")),
            ],
        ]
        for (const [label, val] of auxPhoneFields) {
            if (val && !isValidPhone(val)) {
                toast.error(`${label} must be in format +92-XXX-XXXXXXX.`)
                return
            }
        }

        // Primary contact + format
        const primary = filled[0] ?? ""
        if (!primary) {
            toast.error("Primary contact number is required.")
            return
        }
        for (const num of filled) {
            if (!isValidPhone(num)) {
                toast.error(`Contact number "${num}" must be in format +92-XXX-XXXXXXX.`)
                return
            }
        }
        for (const num of branchFilled) {
            if (!isValidPhone(num)) {
                toast.error(`Branch phone "${num}" must be in format +92-XXX-XXXXXXX.`)
                return
            }
        }

        setSubmitting(true)

        // Combine RHF values + auxiliary FormData (branch wizard, capacity, etc.)
        const data = {
            ...Object.fromEntries(formData.entries()),
            ...values,
            isBranchless: values.isBranchless,
            contactNumber: filled[0] ?? "",
            contactNumbers: filled,
            ...(contractFile ? { contractUrl: contractFile } : {}),
            contractAttachments: attachments,
            // Branch-specific (out-of-scope) state values
            branchIsLockerBranch,
            branchContactPhone: branchFilled[0] ?? "",
            branchOperationsManagerId: branchOperationsManagerId || null,
            branchRegionId: branchRegionId || null,
            branchRegionalOfficeId: branchRegionalOfficeId || null,
            branchLatitude: branchLatManual || null,
            branchLongitude: branchLngManual || null,
            defaultBranchName: values.isBranchless ? "__branchless_default__" : defaultBranchName,
        }

        try {
            const response = await fetch("/api/clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            const respBody = await response.json().catch(() => ({}))

            if (!response.ok) {
                const msg =
                    (respBody && typeof respBody === "object" && "message" in respBody &&
                        typeof respBody.message === "string"
                        ? respBody.message
                        : null) || "Failed to create client"
                toast.error(msg)
                setSubmitting(false)
                return
            }

            toast.success("Client created")

            if (!values.isBranchless) {
                const branchCreated =
                    Array.isArray(respBody.branches) && respBody.branches.length > 0
                setSavedClient({
                    id: respBody.id,
                    name: respBody.name,
                    branchCreated,
                })
            } else {
                router.push(`/clients/${respBody.id}`)
                router.refresh()
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to create client"
            toast.error(msg)
            setSubmitting(false)
        }
    }

    // Surface zod validation failures so the submit button doesn't appear inert.
    const onInvalid = (errors: FieldErrors<ClientCreateForm>) => {
        const firstMessage = Object.values(errors).flatMap((e) => {
            if (!e) return []
            if (typeof e === "object" && "message" in e && typeof e.message === "string") return [e.message]
            return []
        })[0]
        toast.error(firstMessage ?? "Please fix the highlighted fields and try again.")
        console.warn("Client form validation errors", errors)
    }

    // ── Success state (branch client only) ──────────────────────────────────
    if (savedClient) {
        return (
            <Card className="p-8 flex flex-col items-center gap-6 text-center">
                <CheckCircle2 className="h-14 w-14 text-green-500" />
                <div>
                    <h2 className="text-xl font-semibold text-[var(--text)]">{savedClient.name} saved!</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                        {savedClient.branchCreated
                            ? "Branch client created with its first branch. You can add more branches anytime."
                            : "Branch client created. No branch was added yet — you can add one now or later."}
                    </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    <Button asChild>
                        <Link href={`/clients/${savedClient.id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Client
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href={`/clients/${savedClient.id}/branches/new`}>
                            <Plus className="mr-2 h-4 w-4" />
                            {savedClient.branchCreated ? "Add Another Branch" : "Add a Branch"}
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/clients/new">Add Another Client</Link>
                    </Button>
                </div>
            </Card>
        )
    }

    return (
        <Form {...form}>
            <form
                ref={formRef}
                // eslint-disable-next-line react-hooks/refs -- onSubmit reads formRef.current only inside the submit callback (runtime), not during render.
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
                                            <div>
                                                <SearchSelect
                                                    name="type"
                                                    options={clientTypes}
                                                    defaultValue={field.value || ""}
                                                    placeholder={
                                                        clientTypes.length === 0
                                                            ? "Loading types…"
                                                            : "Select client type"
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
                                        <FormLabel>
                                            Client&apos;s Email <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="Client's Email" {...field} />
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
                                        <FormLabel>
                                            Enrollment Date <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                readOnly={!isSuperAdmin}
                                                className={
                                                    !isSuperAdmin
                                                        ? "bg-[var(--surface-muted)] cursor-not-allowed"
                                                        : ""
                                                }
                                                {...field}
                                            />
                                        </FormControl>
                                        {!isSuperAdmin && (
                                            <FormDescription>
                                                Auto-set to today. Only Super Admin can override.
                                            </FormDescription>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
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
                                                onClick={() => {
                                                    field.onChange(false)
                                                    setLatManual("")
                                                    setLngManual("")
                                                }}
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
                                                onClick={() => {
                                                    field.onChange(true)
                                                    setLatManual("")
                                                    setLngManual("")
                                                }}
                                                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-[var(--border)] ${
                                                    field.value
                                                        ? "bg-[var(--brand)] text-white"
                                                        : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]"
                                                }`}
                                            >
                                                Branchless Client
                                            </button>
                                        </div>
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
                                        <FormLabel>
                                            Contact Person <span className="text-destructive">*</span>
                                        </FormLabel>
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
                                <Label>
                                    Contact Number <span className="text-destructive">*</span>
                                </Label>
                                <div className="space-y-2">
                                    {contactNumbers.map((num, idx) => {
                                        const invalid = num.trim().length > 0 && num.trim() !== "+92-" && !isValidPhone(num.trim())
                                        return (
                                            <div key={idx} className="flex items-start gap-2">
                                                <div className="flex-1">
                                                    <Input
                                                        type="tel"
                                                        value={num}
                                                        onChange={(e) => {
                                                            const formatted = formatPhoneDigits(e.target.value)
                                                            const updated = [...contactNumbers]
                                                            updated[idx] = formatted
                                                            setContactNumbers(updated)
                                                        }}
                                                        onFocus={(e) => {
                                                            if (!e.target.value) {
                                                                const updated = [...contactNumbers]
                                                                updated[idx] = "+92-"
                                                                setContactNumbers(updated)
                                                            }
                                                        }}
                                                        className={invalid ? "border-destructive" : ""}
                                                        placeholder={
                                                            idx === 0
                                                                ? "+92-300-1234567"
                                                                : `Contact number ${idx + 1}`
                                                        }
                                                        maxLength={16}
                                                        autoComplete="tel"
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
                                                            setContactNumbers(
                                                                contactNumbers.filter((_, i) => i !== idx),
                                                            )
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
                                        onClick={() => setContactNumbers([...contactNumbers, ""])}
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
                                        <FormLabel>
                                            Head Office Address <span className="text-destructive">*</span>
                                        </FormLabel>
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
                                            <div
                                                onBlur={(e) => {
                                                    const target = e.target as HTMLInputElement
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
                            {!watchedProvince && (
                                <p className="md:col-span-2 text-sm text-[var(--text-muted)] bg-amber-50 rounded-[var(--radius-md)] px-4 py-3 border border-amber-200">
                                    Select an Operational Territory above before assigning a region.
                                </p>
                            )}

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
                                            disabled={!watchedProvince || isRegionalViewer}
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

                            {/* Manager + Supervisor — branchless only (legacy logic) */}
                            {isBranchless && (
                                <>
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
                                                            options={managerUsers.map((u) => ({
                                                                value: u.id,
                                                                label: u.name,
                                                            }))}
                                                            defaultValue={field.value || ""}
                                                            placeholder={
                                                                watchedRegionId
                                                                    ? "— Select Manager —"
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
                                </>
                            )}

                            {!isBranchless && (
                                <p className="md:col-span-2 text-sm text-[var(--text-muted)] bg-[var(--surface-muted)] rounded-[var(--radius-md)] px-4 py-3 border border-[var(--border)]">
                                    Manager and supervisor will be assigned per branch. Use the branch form below or
                                    the branch wizard after saving.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* ── Default branch wizard (branchless only — kept legacy DOM-managed) ── */}
                <input
                    type="hidden"
                    name="defaultBranchName"
                    value={isBranchless ? "__branchless_default__" : defaultBranchName}
                />
                {isBranchless && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Client Location &amp; Capacity (Default Branch)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            {/* Basic */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">
                                        Name Of Branch <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        name="default_branch_name"
                                        placeholder="e.g., Main Branch, Gulberg Branch"
                                        value={defaultBranchName}
                                        onChange={(e) => setDefaultBranchName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Branch Code</label>
                                    <Input type="text" name="branchCode" placeholder="e.g., LHR-001" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Branch Model</label>
                                    <SearchSelect
                                        name="branchType"
                                        options={[
                                            { value: "CONVENTIONAL", label: "Conventional" },
                                            { value: "ISLAMIC", label: "Islamic" },
                                        ]}
                                        defaultValue="CONVENTIONAL"
                                        placeholder="Select model"
                                    />
                                </div>
                            </div>

                            {/* LocationPickerMap — DO NOT migrate, wrap as-is in shadcn Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Address</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Click to drop marker — or type coordinates manually.
                                    </p>
                                    <LocationPickerMap
                                        latName="branchLatitudeHidden"
                                        lngName="branchLongitudeHidden"
                                        label="Branch"
                                        onLocationChange={(lat, lng) => {
                                            setBranchLatManual(lat)
                                            setBranchLngManual(lng)
                                        }}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                                Latitude <span className="text-destructive">*</span>
                                            </label>
                                            <Input
                                                type="text"
                                                name="branchLatitudeManual"
                                                placeholder="e.g. 31.5204"
                                                value={branchLatManual}
                                                onChange={(e) => setBranchLatManual(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                                Longitude <span className="text-destructive">*</span>
                                            </label>
                                            <Input
                                                type="text"
                                                name="branchLongitudeManual"
                                                placeholder="e.g. 74.3587"
                                                value={branchLngManual}
                                                onChange={(e) => setBranchLngManual(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Branch Region/Office/City — legacy state */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Select Region</label>
                                    <select
                                        className="ui-input disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={branchRegionId}
                                        onChange={(e) => setBranchRegionId(e.target.value)}
                                        disabled={isRegionalViewer}
                                    >
                                        <option value="">— Select Region —</option>
                                        {regions.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                    {isRegionalViewer && (
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                            Locked to your assigned region.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">
                                        Select Regional Office
                                    </label>
                                    <select
                                        name="branchRegionalOfficeId"
                                        className="ui-input disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={branchRegionalOfficeId}
                                        onChange={(e) => setBranchRegionalOfficeId(e.target.value)}
                                        disabled={!branchRegionId || Boolean(lockedRegionalOffice)}
                                    >
                                        <option value="">
                                            {!branchRegionId
                                                ? "— Select Region First —"
                                                : branchRegionalOffices.length === 0
                                                  ? "No offices"
                                                  : "— Select Office —"}
                                        </option>
                                        {branchRegionalOffices.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.name}
                                            </option>
                                        ))}
                                    </select>
                                    {lockedRegionalOffice && (
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                            Locked to your assigned regional office.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">City (follows region)</label>
                                    <input
                                        type="text"
                                        name="branchCity"
                                        value={branchCityDerived}
                                        readOnly
                                        disabled
                                        placeholder="Set by selecting a region"
                                        className="ui-input bg-[var(--surface-muted)] cursor-not-allowed opacity-75"
                                    />
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                                        Derived automatically from the selected region.
                                    </p>
                                </div>
                            </div>

                            {/* Capacity Matrix */}
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text)] mb-3">
                                    Capacity Requirements
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <BCapField label="Day CPO's Required" name="branchDayCpoCapacity" />
                                    <BCapField label="Night CPO's Required" name="branchNightCpoCapacity" />
                                    <BCapField label="Day SO Capacity" name="branchDaySoCapacity" />
                                    <BCapField label="Night SO Capacity" name="branchNightSoCapacity" />
                                    <BCapField label="Day ASO Capacity" name="branchDayAsoCapacity" />
                                    <BCapField label="Night ASO Capacity" name="branchNightAsoCapacity" />
                                    <BCapField label="Day LSO Capacity" name="branchDayLsoCapacity" />
                                    <BCapField label="Night LSO Capacity" name="branchNightLsoCapacity" />
                                    <BCapField
                                        label="Day Supervisors Required"
                                        name="branchDaySupervisorCapacity"
                                    />
                                    <BCapField
                                        label="Night Supervisors Required"
                                        name="branchNightSupervisorCapacity"
                                    />
                                    <BCapField label="Day Guards" name="branchDayGuardCapacity" />
                                    <BCapField label="Night Guards" name="branchNightGuardCapacity" />
                                    <BCapField label="Day CCTV Operators" name="branchDayCctvCapacity" />
                                    <BCapField label="Night CCTV Operators" name="branchNightCctvCapacity" />
                                    <BCapField label="Day Receptionists" name="branchDayReceptionistCapacity" />
                                    <BCapField
                                        label="Night Receptionists"
                                        name="branchNightReceptionistCapacity"
                                    />
                                </div>
                            </div>

                            {/* Enrollment + locker */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">
                                        Branch Enrollment Date <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="date"
                                        name="branchEnrollmentDate"
                                        defaultValue={todayIso}
                                        readOnly={!isSuperAdmin}
                                        className={
                                            !isSuperAdmin ? "bg-[var(--surface-muted)] cursor-not-allowed" : ""
                                        }
                                    />
                                    {!isSuperAdmin && (
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                            Auto-set to today. Only Super Admin can override.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-2">
                                        Locker Branch <span className="text-destructive">*</span>
                                    </label>
                                    <div className="flex items-center gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="branchIsLockerBranchRadio"
                                                value="yes"
                                                checked={branchIsLockerBranch === "yes"}
                                                onChange={() => setBranchIsLockerBranch("yes")}
                                                className="h-4 w-4 accent-[var(--brand)]"
                                            />
                                            <span className="text-sm text-[var(--text)]">Yes</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="branchIsLockerBranchRadio"
                                                value="no"
                                                checked={branchIsLockerBranch === "no"}
                                                onChange={() => setBranchIsLockerBranch("no")}
                                                className="h-4 w-4 accent-[var(--brand)]"
                                            />
                                            <span className="text-sm text-[var(--text)]">No</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Branch contact person */}
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text)] mb-3 pb-1 border-b border-[var(--border)]">
                                    Contact Person Info
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
                                        <Input
                                            type="text"
                                            name="branchContactPerson"
                                            placeholder="Contact person name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">
                                            Designation
                                        </label>
                                        <Input
                                            type="text"
                                            name="branchContactPersonDesignation"
                                            placeholder="e.g., Branch Manager"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">CNIC #</label>
                                        <CnicInput name="branchContactPersonCnic" placeholder="#####-#######-#" />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">
                                            Phone Number
                                        </label>
                                        <div className="space-y-2">
                                            {branchContactPhones.map((num, idx) => {
                                                const invalid =
                                                    num.trim().length > 0 && !isValidPhone(num.trim())
                                                return (
                                                    <div key={idx} className="flex items-start gap-2">
                                                        <div className="flex-1">
                                                            <Input
                                                                type="tel"
                                                                value={num}
                                                                onChange={(e) => {
                                                                    const updated = [...branchContactPhones]
                                                                    updated[idx] = e.target.value
                                                                    setBranchContactPhones(updated)
                                                                }}
                                                                className={invalid ? "border-destructive" : ""}
                                                                placeholder={
                                                                    idx === 0
                                                                        ? "+92-300-1234567"
                                                                        : `Phone ${idx + 1}`
                                                                }
                                                            />
                                                            {invalid && (
                                                                <p className="mt-1 text-[11px] text-destructive">
                                                                    Format must be +92-300-1234567
                                                                </p>
                                                            )}
                                                        </div>
                                                        {branchContactPhones.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setBranchContactPhones(
                                                                        branchContactPhones.filter(
                                                                            (_, i) => i !== idx,
                                                                        ),
                                                                    )
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
                                                onClick={() =>
                                                    setBranchContactPhones([...branchContactPhones, ""])
                                                }
                                                className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline mt-1"
                                            >
                                                <Plus size={13} /> Add another number
                                            </button>
                                        </div>
                                        {branchContactPhones
                                            .filter((p) => p.trim())
                                            .map((p, idx) => (
                                                <input
                                                    key={idx}
                                                    type="hidden"
                                                    name={
                                                        idx === 0
                                                            ? "branchContactPhone"
                                                            : `branchContactPhone_${idx}`
                                                    }
                                                    value={p}
                                                />
                                            ))}
                                    </div>
                                </div>
                            </div>

                            {/* Branch manager info */}
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text)] mb-3 pb-1 border-b border-[var(--border)]">
                                    Branch Manager&apos;s Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
                                        <Input
                                            type="text"
                                            name="branchManagerName"
                                            placeholder="Manager's full name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">
                                            Contact Number
                                        </label>
                                        <PhoneInput name="branchManagerContact" />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Email</label>
                                        <Input
                                            type="email"
                                            name="branchManagerEmail"
                                            placeholder="manager@example.com"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Branch-mode wizard (legacy preserved out-of-scope) */}
                {!isBranchless && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Add Client&apos;s New Branch</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <p className="text-sm text-[var(--text-muted)]">
                                Branch wizard fields (location, capacity, contact, ops manager, supervisor) are
                                preserved as legacy widgets — branches are out of scope for the Phase 4B follow-up
                                reskin. Submitting will create the client and its first branch.
                            </p>

                            {/* Operations Manager */}
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text)] mb-3 pb-1 border-b border-[var(--border)]">
                                    Operations Manager&apos;s Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">
                                            Manager <span className="text-destructive">*</span>
                                        </label>
                                        <SearchSelect
                                            name="_branchOpsManagerSelect"
                                            options={branchManagerUsers.map((u) => ({
                                                value: u.id,
                                                label: u.name,
                                            }))}
                                            placeholder={
                                                branchRegionId
                                                    ? "— Select Manager —"
                                                    : "— Select Region First —"
                                            }
                                            onChange={(val) => setBranchOperationsManagerId(val)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">
                                            Manager Contact Number
                                        </label>
                                        <PhoneInput name="branchOperationsManagerContact" />
                                    </div>
                                </div>
                            </div>

                            {/* Supervisor */}
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text)] mb-3 pb-1 border-b border-[var(--border)]">
                                    Supervisor&apos;s Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">
                                            Supervisor <span className="text-destructive">*</span>
                                        </label>
                                        <SearchSelect
                                            name="branchAssignedSupervisorId"
                                            options={branchSupervisorUsers.map((u) => ({
                                                value: u.id,
                                                label: u.name,
                                            }))}
                                            placeholder={
                                                branchRegionId
                                                    ? "— Select Supervisor —"
                                                    : "— Select Region First —"
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">
                                            Supervisor Contact Number
                                        </label>
                                        <PhoneInput name="branchSupervisorContact" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Contract PDF */}
                <Card>
                    <CardHeader>
                        <CardTitle>Contract Attachment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <label className="block text-sm text-[var(--text-muted)] mb-2">
                            Upload Client Contract (PDF / Image, max 5 MB)
                        </label>
                        {contractFile ? (
                            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-green-200 bg-green-50 px-4 py-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                <span className="text-sm text-green-800 font-medium flex-1 truncate">
                                    {contractFileName}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setContractFile(null)
                                        setContractFileName("")
                                    }}
                                    className="text-destructive hover:text-red-700 flex-shrink-0"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <label className="flex items-center gap-3 cursor-pointer rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border)] px-4 py-5 hover:border-[var(--brand)] transition-colors">
                                <Upload className="h-5 w-5 text-[var(--text-muted)]" />
                                <span className="text-sm text-[var(--text-muted)]">
                                    Click to upload PDF or image
                                </span>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={(e) => handleContractFile(e.target.files?.[0] || null)}
                                />
                            </label>
                        )}
                    </CardContent>
                </Card>

                {/* Additional attachments */}
                <Card>
                    <CardHeader>
                        <CardTitle>Additional Attachments</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-2">
                                Upload Files (PDF, Word, Images)
                            </label>
                            <input
                                ref={attachFileRef}
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={handleAttachmentAdd}
                                className="block w-full text-sm text-[var(--text-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[var(--brand)] file:text-white hover:file:opacity-90 cursor-pointer border border-[var(--border)] rounded-[var(--radius-md)] px-2 py-1.5"
                            />
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                You can select multiple files.
                            </p>
                        </div>
                        {attachments.length > 0 ? (
                            <div className="space-y-2">
                                {attachments.map((att, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Paperclip
                                                size={13}
                                                className="flex-shrink-0 text-[var(--text-muted)]"
                                            />
                                            <span className="truncate text-[var(--text)]">{att.name}</span>
                                            <a
                                                href={att.dataUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-shrink-0 text-xs text-[var(--brand)] hover:underline"
                                            >
                                                Preview
                                            </a>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(idx)}
                                            className="flex-shrink-0 ml-3 text-[var(--text-muted)] hover:text-destructive"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] italic">
                                No attachments added yet.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Form actions */}
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.push("/clients")}
                        disabled={submitting}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Cancel
                    </Button>
                    <PermissionGate module="CLIENTS" action="CREATE" mode="disable">
                        <Button type="submit" disabled={submitting}>
                            <Save className="mr-2 h-4 w-4" />
                            {submitting ? "Saving…" : "Create Client"}
                        </Button>
                    </PermissionGate>
                </div>
            </form>
        </Form>
    )
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function BCapField({ label, name }: { label: string; name: string }) {
    return (
        <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
                {label} <span className="text-destructive">*</span>
            </label>
            <Input type="number" name={name} placeholder="0" min={0} defaultValue={0} />
        </div>
    )
}
