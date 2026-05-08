/**
 * Parwest ERP — Branch Create Form (Phase 4B follow-up reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * RHF + zod + shadcn primitives. Reskin only — same fields, same validation
 * rules, same `POST /api/branches` payload as the legacy form.
 *
 * The capacity / contract / attachment sections still submit through the
 * native `<form>` FormData path (a deep RHF migration of every CapField is
 * out of scope for the reskin — the server is the source of truth and
 * already accepts the legacy payload shape).
 *
 * Aux widgets that are NOT migrated (legacy preserved):
 *   - <PhoneInput>          — uncontrolled +92-XXX-XXXXXXX formatter
 *   - <CnicInput>           — uncontrolled XXXXX-XXXXXXX-X formatter
 *   - <SearchSelect>        — searchable native select
 *   - <MultiSearchSelect>   — multi-select chip picker
 *   - <LocationPickerMap>   — Leaflet picker (wrapped in shadcn Card)
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ArrowLeft, Save, X, Plus } from "lucide-react"

import SearchSelect from "@/components/ui/SearchSelect"
import MultiSearchSelect from "@/components/ui/MultiSearchSelect"
import LocationPickerMap from "@/components/ui/LocationPickerMap"
import CnicInput from "@/components/ui/CnicInput"
import PhoneInput from "@/components/ui/PhoneInput"
import { isValidPhone } from "@/lib/validation/formats"
import { branchCreateSchema, type BranchCreateForm } from "@/lib/schemas/branch"

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

type Region = { id: string; name: string }

type Props = {
    clientId: string
    clientName: string
    regions: Region[]
    defaultRegionId?: string | null
    defaultRegionalOfficeId?: string | null
    defaultManagerId?: string | null
    isSuperAdmin?: boolean
    viewerRegionId?: string | null
    viewerRegionalOfficeId?: string | null
}

const OFFICE_TYPE_OPTIONS = [
    "Main Branch", "Sub Branch", "Regional Office", "Area Office",
    "Field Office", "Cash Office", "ATM Site", "Warehouse", "Checkpoint", "Other",
].map((t) => ({ value: t, label: t }))

const PROVINCE_OPTIONS = [
    { value: "Punjab", label: "Punjab" },
    { value: "Sindh", label: "Sindh" },
    { value: "KPK", label: "Khyber Pakhtunkhwa" },
    { value: "Balochistan", label: "Balochistan" },
    { value: "Islamabad", label: "Islamabad Capital Territory" },
]

// Province → cities map. The City dropdown is filtered by the selected
// Province so e.g. "KPK" cannot have "Lahore" picked (ticket #47).
const CITIES_BY_PROVINCE: Record<string, string[]> = {
    Punjab: [
        "Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala", "Sialkot",
        "Bahawalpur", "Sargodha", "Sahiwal", "Sheikhupura", "Kasur", "Okara",
        "Khanewal", "Mian Channu", "Burewala", "Jhang", "Toba Tek Singh",
        "Dera Ghazi Khan", "Rahim Yar Khan", "Khanpur", "Ahmedpur East", "Ali Pur",
        "Arifwala", "Attock", "Bahawalnagar", "Bhalwal", "Bhakkar", "Chakwal",
        "Chiniot", "Chichawatni", "Daska", "Bhaipheru", "Chowk Azam",
        "Chowk Sarwar Shaheed", "Basti Malook", "Bhagalchur", "Chailianwala",
        "Ahmed Nager Chatha",
    ],
    Sindh: [
        "Karachi", "Hyderabad", "Sukkur", "Larkana", "Mirpur Khas", "Nawabshah",
        "Thatta", "Jacobabad", "Shikarpur", "Khairpur", "Dadu", "Ghotki", "Badin",
        "Tando Adam", "Tando Allahyar", "Tando Muhammad Khan",
    ],
    KPK: [
        "Peshawar", "Mardan", "Mingora", "Abbottabad", "Kohat", "Bannu",
        "Dera Ismail Khan", "Swabi", "Charsadda", "Nowshera", "Haripur", "Mansehra",
        "Chitral", "Hangu", "Karak", "Lakki Marwat", "Tank", "Battagram",
    ],
    Balochistan: [
        "Quetta", "Turbat", "Khuzdar", "Hub", "Chaman", "Gwadar", "Sibi",
        "Dera Murad Jamali", "Loralai", "Zhob", "Kalat", "Mastung", "Pasni",
    ],
    Islamabad: ["Islamabad"],
}

const ALL_CITY_OPTIONS = Object.values(CITIES_BY_PROVINCE)
    .flat()
    .map((c) => ({ value: c, label: c }))

function getCityOptionsForProvince(province: string): { value: string; label: string }[] {
    if (!province) return ALL_CITY_OPTIONS
    const cities = CITIES_BY_PROVINCE[province] ?? []
    return cities.map((c) => ({ value: c, label: c }))
}

const BRANCH_MODEL_OPTIONS = [
    { value: "CONVENTIONAL", label: "Conventional" },
    { value: "ISLAMIC", label: "Islamic" },
]

export default function BranchForm({
    clientId,
    clientName,
    regions,
    defaultRegionId,
    defaultRegionalOfficeId: _defaultRegionalOfficeId,
    defaultManagerId,
    isSuperAdmin = false,
    viewerRegionId = null,
    viewerRegionalOfficeId = null,
}: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const isRegionalViewer = !isSuperAdmin && Boolean(viewerRegionId)
    const lockedRegionalOffice = isRegionalViewer ? viewerRegionalOfficeId : null
    const [submitting, setSubmitting] = useState(false)

    // Region / Regional Office (dynamic cascade)
    const [selectedRegionId, setSelectedRegionId] = useState(
        isRegionalViewer ? (viewerRegionId ?? "") : (defaultRegionId ?? ""),
    )
    // Ticket #46: Don't pre-select a regional office unless the viewer is
    // region-locked. Even when a `defaultRegionalOfficeId` is passed in, an
    // unlocked Super Admin should explicitly choose. Preselecting was the
    // QA-reported "by default it shouldn't be selecting a regional office".
    const [selectedRegionalOfficeId, setSelectedRegionalOfficeId] = useState(
        lockedRegionalOffice ?? "",
    )
    const [regionalOffices, setRegionalOffices] = useState<{ id: string; name: string }[]>([])

    // Manager / Supervisor (filtered by region)
    const [managerUsers, setManagerUsers] = useState<{ id: string; name: string }[]>([])
    const [supervisorUsers, setSupervisorUsers] = useState<{ id: string; name: string }[]>([])

    // Map → manual lat/lng auto-fill
    const [latManual, setLatManual] = useState("")
    const [lngManual, setLngManual] = useState("")

    // Locker branch radio
    const [isLockerBranch, setIsLockerBranch] = useState<"yes" | "no">("no")

    // Operations manager selection (separate from assigned manager)
    const [selectedOperationsManagerId, setSelectedOperationsManagerId] = useState("")

    // Multiple contact phones
    const [contactPhones, setContactPhones] = useState<string[]>([""])

    // Dynamic designation + ex-service options from prerequisites config
    const [designationOptions, setDesignationOptions] = useState<{ value: string; label: string }[]>([])
    const [exServiceOptions, setExServiceOptions] = useState<{ value: string; label: string }[]>([])

    // Additional file attachments (multi)
    const [attachments, setAttachments] = useState<{ name: string; dataUrl: string }[]>([])
    const fileRef = useRef<HTMLInputElement>(null)

    const form = useForm<BranchCreateForm>({
        resolver: zodResolver(branchCreateSchema),
        mode: "onBlur",
        defaultValues: {
            name: "",
            code: "",
            branchType: "CONVENTIONAL",
            officeType: "",
            isHeadOffice: false,
            isLockerBranch: "no",
            enrollmentDate: new Date().toISOString().slice(0, 10),
            address: "",
            city: "",
            province: "",
            latitudeManual: "",
            longitudeManual: "",
            regionId: selectedRegionId,
            regionalOfficeId: selectedRegionalOfficeId,
            assignedManagerId: defaultManagerId ?? "",
            assignedSupervisorId: "",
            operationsManagerId: "",
            contactPerson: "",
            contactPersonDesignation: "",
            contactPersonCnic: "",
            contactEmail: "",
            branchManagerName: "",
            branchManagerContact: "",
            branchManagerEmail: "",
            operationsManagerContact: "",
            supervisorContact: "",
            contractStart: "",
            contractEnd: "",
            contractRateStart: "",
            contractRateEnd: "",
            contractAdditionalDayGuards: "",
            contractAdditionalNightGuards: "",
        },
    })

    // Fetch designation types and ex-service types once on mount
    useEffect(() => {
        fetch("/api/guard-designation-types")
            .then((r) => (r.ok ? r.json() : []))
            .then((data: unknown) => {
                if (Array.isArray(data))
                    setDesignationOptions(
                        (data as { name: string }[]).map((d) => ({ value: d.name, label: d.name })),
                    )
            })
            .catch(() => {})
        fetch("/api/guard-ex-service-types")
            .then((r) => (r.ok ? r.json() : []))
            .then((data: unknown) => {
                if (Array.isArray(data))
                    setExServiceOptions(
                        (data as { name: string }[]).map((d) => ({ value: d.name, label: d.name })),
                    )
            })
            .catch(() => {})
    }, [])

    // Load regional offices when region changes
    useEffect(() => {
        if (selectedRegionId !== (defaultRegionId ?? "")) {
            setSelectedRegionalOfficeId("")
        }
        setRegionalOffices([])
        if (!selectedRegionId) return
        fetch(`/api/regional-offices?regionId=${selectedRegionId}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setRegionalOffices(
                        (data as { id: string; name: string }[]).map((o) => ({ id: o.id, name: o.name })),
                    )
                }
            })
            .catch(() => {})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRegionId])

    // Load managers/supervisors when region changes
    useEffect(() => {
        const url = selectedRegionId
            ? `/api/users?limit=500&regionId=${selectedRegionId}`
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
    }, [selectedRegionId])

    const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        files.forEach((file) => {
            const reader = new FileReader()
            reader.onload = () =>
                setAttachments((prev) => [...prev, { name: file.name, dataUrl: reader.result as string }])
            reader.readAsDataURL(file)
        })
        if (fileRef.current) fileRef.current.value = ""
    }

    const removeAttachment = (idx: number) =>
        setAttachments((prev) => prev.filter((_, i) => i !== idx))

    // RHF submit. The capacity / contract grids submit via FormData; we read
    // those fields off the underlying <form> element for the API payload.
    const onSubmit = async (values: BranchCreateForm) => {
        if (!formRef.current) return

        // At least one contactPhone is required + format check (mirrors legacy)
        const filledPhones = contactPhones.filter((n) => n.trim())
        if (filledPhones.length === 0) {
            toast.error("At least one contact phone number is required.")
            return
        }
        for (const num of filledPhones) {
            if (!isValidPhone(num)) {
                toast.error(`Contact phone "${num}" must be in format +92-XXX-XXXXXXX.`)
                return
            }
        }

        // Build the legacy payload from FormData for fields that still live in
        // native <input> elements (capacity grid, contract designations, etc.)
        const formData = new FormData(formRef.current)
        const payload: Record<string, unknown> = {
            ...Object.fromEntries(formData.entries()),
            // RHF-validated values override raw FormData (numbers, booleans, etc.)
            ...values,
            clientId,
            isHeadOffice: Boolean(values.isHeadOffice),
            isLockerBranch,
            contractAttachments: attachments,
            regionId: selectedRegionId || null,
            regionalOfficeId: selectedRegionalOfficeId || null,
            operationsManagerId: selectedOperationsManagerId || null,
        }

        // API contract (POST /api/branches): single flat `contactPhone` string.
        // Indexed `contactPhone_<idx>` keys are silently ignored (and earlier
        // were corrupting the payload via FormData spread → 500). Send only
        // the first phone here; persist the rest once the API supports an
        // additional-phones array.
        payload.contactPhone = filledPhones[0]
        // Strip any leftover indexed keys spread in from FormData.
        Object.keys(payload).forEach((k) => {
            if (/^contactPhone_\d+$/.test(k)) delete payload[k]
        })

        setSubmitting(true)
        try {
            const response = await fetch("/api/branches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                const msg =
                    (data && typeof data === "object" && "message" in data && typeof data.message === "string"
                        ? data.message
                        : null) || "Failed to create branch"
                toast.error(msg)
                setSubmitting(false)
                return
            }

            toast.success("Branch created")
            router.push(`/clients/${clientId}?tab=branches`)
            router.refresh()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unexpected error"
            toast.error(msg)
            setSubmitting(false)
        }
    }

    return (
        <Form {...form}>
            <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* ── Add Client's New Branch ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Add Client&apos;s New Branch</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Creating branch for: <span className="font-medium text-foreground">{clientName}</span>
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Name Of Branch <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g., Main Branch, Gulberg Branch"
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
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Branch Code</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g., LHR-001, ISB-002"
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
                                name="branchType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Branch Model</FormLabel>
                                        <FormControl>
                                            <div>
                                                <SearchSelect
                                                    name="branchType"
                                                    options={BRANCH_MODEL_OPTIONS}
                                                    defaultValue={field.value || "CONVENTIONAL"}
                                                    placeholder="Select model"
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
                                name="officeType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Office Type</FormLabel>
                                        <FormControl>
                                            <div>
                                                <SearchSelect
                                                    name="officeType"
                                                    options={OFFICE_TYPE_OPTIONS}
                                                    defaultValue={field.value || ""}
                                                    placeholder="— Select Office Type —"
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
                                name="isHeadOffice"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(field.value)}
                                                onChange={(e) => field.onChange(e.target.checked)}
                                                className="h-4 w-4 accent-[var(--brand)]"
                                            />
                                            <span className="text-sm text-foreground">This is the head office</span>
                                        </label>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* ── Address (Leaflet picker preserved as-is, wrapped in Card) ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Address</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Address</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                rows={2}
                                                placeholder="Enter complete address"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/*
                              Ticket #47: city options depend on province.
                              We render Province first, then City filtered by it.
                              Selecting a new province clears the city if the
                              old city isn't valid in the new province.
                            */}
                            <FormField
                                control={form.control}
                                name="province"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Province</FormLabel>
                                        <FormControl>
                                            <div>
                                                <SearchSelect
                                                    name="province"
                                                    options={PROVINCE_OPTIONS}
                                                    defaultValue={field.value || ""}
                                                    placeholder="Select province"
                                                    onChange={(v) => {
                                                        field.onChange(v)
                                                        const validCities = CITIES_BY_PROVINCE[v] ?? []
                                                        const currentCity = form.getValues("city")
                                                        if (currentCity && !validCities.includes(currentCity)) {
                                                            form.setValue("city", "", { shouldValidate: true })
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => {
                                    const province = form.watch("province")
                                    const cityOptions = getCityOptionsForProvince(province ?? "")
                                    return (
                                        <FormItem>
                                            <FormLabel>City</FormLabel>
                                            <FormControl>
                                                <div>
                                                    <SearchSelect
                                                        // key forces remount when province changes so
                                                        // SearchSelect's internal defaultValue resets
                                                        key={`city-${province ?? "all"}`}
                                                        name="city"
                                                        options={cityOptions}
                                                        defaultValue={field.value || ""}
                                                        placeholder={province ? "Select city" : "Select province first"}
                                                        onChange={(v) => field.onChange(v)}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )
                                }}
                            />
                        </div>

                        {/* Map picker — Leaflet preserved as-is */}
                        <div>
                            <Label>
                                Pick Branch Location on Map
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                    (search or click to drop marker — or type coordinates manually below)
                                </span>
                            </Label>
                            <div className="mt-2">
                                <LocationPickerMap
                                    latName="latitude"
                                    lngName="longitude"
                                    label="Branch"
                                    onLocationChange={(lat, lng) => {
                                        setLatManual(lat)
                                        setLngManual(lng)
                                    }}
                                />
                            </div>
                        </div>

                        {/* Manual coordinate override */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label>
                                    Latitude <span className="text-destructive">*</span>{" "}
                                    <span className="text-xs font-normal">(manual override)</span>
                                </Label>
                                <Input
                                    name="latitudeManual"
                                    placeholder="e.g. 31.5204"
                                    value={latManual}
                                    onChange={(e) => setLatManual(e.target.value)}
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <Label>
                                    Longitude <span className="text-destructive">*</span>{" "}
                                    <span className="text-xs font-normal">(manual override)</span>
                                </Label>
                                <Input
                                    name="longitudeManual"
                                    placeholder="e.g. 74.3587"
                                    value={lngManual}
                                    onChange={(e) => setLngManual(e.target.value)}
                                    className="mt-2"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Region & Assignment ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Region &amp; Assignment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label>Select Region</Label>
                                <Select
                                    value={selectedRegionId || "__NONE__"}
                                    onValueChange={(v) => setSelectedRegionId(v === "__NONE__" ? "" : v)}
                                    disabled={isRegionalViewer}
                                >
                                    <SelectTrigger className="mt-2">
                                        <SelectValue placeholder="— Select Region —" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__NONE__">— Select Region —</SelectItem>
                                        {regions.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {isRegionalViewer && (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Locked to your assigned region.
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label>Select Regional Office</Label>
                                <Select
                                    value={selectedRegionalOfficeId || "__NONE__"}
                                    onValueChange={(v) => setSelectedRegionalOfficeId(v === "__NONE__" ? "" : v)}
                                    disabled={!selectedRegionId || Boolean(lockedRegionalOffice)}
                                >
                                    <SelectTrigger className="mt-2">
                                        <SelectValue
                                            placeholder={
                                                !selectedRegionId
                                                    ? "— Select Region First —"
                                                    : regionalOffices.length === 0
                                                      ? "No offices in this region"
                                                      : "— Select Regional Office —"
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__NONE__">— Select Regional Office —</SelectItem>
                                        {regionalOffices.map((o) => (
                                            <SelectItem key={o.id} value={o.id}>
                                                {o.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <input type="hidden" name="regionalOfficeId" value={selectedRegionalOfficeId} />
                                {lockedRegionalOffice && (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Locked to your assigned regional office.
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label>Assigned Manager</Label>
                                <div className="mt-2">
                                    <SearchSelect
                                        name="assignedManagerId"
                                        options={managerUsers.map((u) => ({ value: u.id, label: u.name }))}
                                        defaultValue={defaultManagerId ?? ""}
                                        placeholder={selectedRegionId ? "— Select Manager —" : "— Select Region First —"}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Capacity Requirements ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Capacity Requirements</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <CapField label="Day CPO's Required" name="dayCpoCapacity" required />
                            <CapField label="Night CPO's Required" name="nightCpoCapacity" required />
                            <CapField label="Day SO Capacity" name="daySoCapacity" required />
                            <CapField label="Night SO Capacity" name="nightSoCapacity" required />
                            <CapField label="Day ASO Capacity" name="dayAsoCapacity" required />
                            <CapField label="Night ASO Capacity" name="nightAsoCapacity" required />
                            <CapField label="Day LSO Capacity" name="dayLsoCapacity" required />
                            <CapField label="Night LSO Capacity" name="nightLsoCapacity" required />
                            <CapField label="Day Supervisors Required" name="daySupervisorCapacity" required />
                            <CapField label="Night Supervisors Required" name="nightSupervisorCapacity" required />
                            <CapField label="Day Guards" name="dayGuardCapacity" required />
                            <CapField label="Night Guards" name="nightGuardCapacity" required />
                            <CapField label="Day CCTV Operators" name="dayCctvCapacity" required />
                            <CapField label="Night CCTV Operators" name="nightCctvCapacity" required />
                            <CapField label="Day Receptionists" name="dayReceptionistCapacity" required />
                            <CapField label="Night Receptionists" name="nightReceptionistCapacity" required />
                        </div>
                    </CardContent>
                </Card>

                {/* ── Branch Details / Locker ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Branch Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="enrollmentDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Branch Enrollment Date <span className="text-destructive">*</span>
                                        </FormLabel>
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
                                                Auto-set to today. Only Super Admin can override.
                                            </FormDescription>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div>
                                <Label>
                                    Locker Branch <span className="text-destructive">*</span>
                                </Label>
                                <div className="flex items-center gap-6 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="isLockerBranchRadio"
                                            value="yes"
                                            checked={isLockerBranch === "yes"}
                                            onChange={() => setIsLockerBranch("yes")}
                                            className="h-4 w-4 accent-[var(--brand)]"
                                        />
                                        <span className="text-sm text-foreground">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="isLockerBranchRadio"
                                            value="no"
                                            checked={isLockerBranch === "no"}
                                            onChange={() => setIsLockerBranch("no")}
                                            className="h-4 w-4 accent-[var(--brand)]"
                                        />
                                        <span className="text-sm text-foreground">No</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Contact Person Info ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Contact Person Info</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="contactPerson"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Name of contact person"
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
                                name="contactPersonDesignation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Designation</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g., Branch Manager, Officer"
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
                                name="contactPersonCnic"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CNIC #</FormLabel>
                                        <FormControl>
                                            <div
                                                onBlur={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "contactPersonCnic") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                                onChangeCapture={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "contactPersonCnic") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                            >
                                                <CnicInput
                                                    name="contactPersonCnic"
                                                    placeholder="#####-#######-#"
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div>
                                <Label>
                                    Phone Number <span className="text-destructive">*</span>
                                </Label>
                                <div className="space-y-2 mt-2">
                                    {contactPhones.map((num, idx) => {
                                        const invalid = num.trim().length > 0 && !isValidPhone(num.trim())
                                        return (
                                            <div key={idx} className="flex items-start gap-2">
                                                <div className="flex-1">
                                                    <Input
                                                        type="tel"
                                                        value={num}
                                                        onChange={(e) => {
                                                            const updated = [...contactPhones]
                                                            updated[idx] = e.target.value
                                                            setContactPhones(updated)
                                                        }}
                                                        className={invalid ? "border-destructive" : ""}
                                                        placeholder={idx === 0 ? "+92-300-1234567" : `Phone ${idx + 1}`}
                                                    />
                                                    {invalid && (
                                                        <p className="mt-1 text-[11px] text-destructive">
                                                            Format must be +92-300-1234567
                                                        </p>
                                                    )}
                                                </div>
                                                {contactPhones.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setContactPhones(contactPhones.filter((_, i) => i !== idx))
                                                        }
                                                        className="flex-shrink-0 mt-2 text-muted-foreground hover:text-destructive"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => setContactPhones([...contactPhones, ""])}
                                        className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline mt-1"
                                    >
                                        <Plus size={13} /> Add another number
                                    </button>
                                </div>
                            </div>
                            <FormField
                                control={form.control}
                                name="contactEmail"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="branch@example.com"
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

                {/* ── Branch Manager's Information ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Branch Manager&apos;s Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField
                                control={form.control}
                                name="branchManagerName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Manager's full name"
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
                                name="branchManagerContact"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Number</FormLabel>
                                        <FormControl>
                                            <div
                                                onBlur={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "branchManagerContact") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                                onChangeCapture={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "branchManagerContact") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                            >
                                                <PhoneInput name="branchManagerContact" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="branchManagerEmail"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="manager@example.com"
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

                {/* ── Operations Manager's Information ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Operations Manager&apos;s Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label>
                                    Manager <span className="text-destructive">*</span>
                                </Label>
                                <div className="mt-2">
                                    <SearchSelect
                                        name="_operationsManagerId"
                                        options={managerUsers.map((u) => ({ value: u.id, label: u.name }))}
                                        placeholder={selectedRegionId ? "— Select Manager —" : "— Select Region First —"}
                                        onChange={(val) => setSelectedOperationsManagerId(val)}
                                    />
                                </div>
                            </div>
                            <FormField
                                control={form.control}
                                name="operationsManagerContact"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Manager Contact Number <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <div
                                                onBlur={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "operationsManagerContact") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                                onChangeCapture={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "operationsManagerContact") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                            >
                                                <PhoneInput name="operationsManagerContact" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* ── Supervisor's Information ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Supervisor&apos;s Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label>
                                    Supervisor <span className="text-destructive">*</span>
                                </Label>
                                <div className="mt-2">
                                    <SearchSelect
                                        name="assignedSupervisorId"
                                        options={supervisorUsers.map((u) => ({ value: u.id, label: u.name }))}
                                        placeholder={
                                            selectedRegionId ? "— Select Supervisor —" : "— Select Region First —"
                                        }
                                    />
                                </div>
                            </div>
                            <FormField
                                control={form.control}
                                name="supervisorContact"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Supervisor Contact Number <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <div
                                                onBlur={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "supervisorContact") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                                onChangeCapture={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "supervisorContact") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                            >
                                                <PhoneInput name="supervisorContact" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* ── Branch Contract ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Branch Contract</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="contractStart"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contract Start</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="contractEnd"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contract End</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="contractRateStart"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contract Rate Start</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="contractRateEnd"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contract Rate End</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Day Guards */}
                            <div className="md:col-span-2">
                                <h3 className="text-sm font-semibold text-foreground mb-3 mt-1">Day Guards</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Guard Designation</Label>
                                        <div className="mt-2">
                                            <MultiSearchSelect
                                                name="contractDayGuardDesignation"
                                                options={designationOptions}
                                                placeholder="Select designations"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Guard Ex Service</Label>
                                        <div className="mt-2">
                                            <MultiSearchSelect
                                                name="contractDayGuardExService"
                                                options={exServiceOptions}
                                                placeholder="Select"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Night Guards */}
                            <div className="md:col-span-2">
                                <h3 className="text-sm font-semibold text-foreground mb-3 mt-1">Night Guards</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Guard Designation</Label>
                                        <div className="mt-2">
                                            <MultiSearchSelect
                                                name="contractNightGuardDesignation"
                                                options={designationOptions}
                                                placeholder="Select designations"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Guard Ex Service</Label>
                                        <div className="mt-2">
                                            <MultiSearchSelect
                                                name="contractNightGuardExService"
                                                options={exServiceOptions}
                                                placeholder="Select"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <FormField
                                control={form.control}
                                name="contractAdditionalDayGuards"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Additional Day Guards</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="0"
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
                                name="contractAdditionalNightGuards"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Additional Night Guards</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="0"
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

                {/* ── Additional Attachments ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Additional Attachments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div>
                                <Label>Upload Files (PDF, Word, Images)</Label>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    onChange={handleFileAdd}
                                    className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[var(--brand)] file:text-white hover:file:opacity-90 cursor-pointer border border-[var(--border)] rounded-[var(--radius-md)] px-2 py-1.5 mt-2"
                                />
                                <p className="mt-1 text-sm text-muted-foreground">
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
                                                <span className="truncate text-foreground">{att.name}</span>
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
                                                className="flex-shrink-0 ml-3 text-muted-foreground hover:text-destructive"
                                            >
                                                <X size={15} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No attachments added yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Form Actions */}
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.push(`/clients/${clientId}?tab=branches`)}
                        disabled={submitting}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Cancel
                    </Button>
                    <PermissionGate module="CLIENTS" action="CREATE" mode="hide">
                        <Button type="submit" disabled={submitting}>
                            <Save className="mr-2 h-4 w-4" />
                            {submitting ? "Creating…" : "Create Branch"}
                        </Button>
                    </PermissionGate>
                </div>
            </form>
        </Form>
    )
}

// Helper component for capacity number inputs (uses shadcn Input).
function CapField({ label, name, required }: { label: string; name: string; required?: boolean }) {
    return (
        <div>
            <label className="block text-xs text-muted-foreground mb-1">
                {label}
                {required && <span className="text-destructive ml-0.5">*</span>}
            </label>
            <Input type="number" name={name} placeholder="0" min={0} defaultValue={0} />
        </div>
    )
}
