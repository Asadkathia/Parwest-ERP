"use client"

/**
 * GuardProfileTab — Canonical pattern (Phase 3b template)
 * ------------------------------------------------------------
 * This tab is the reference implementation that the remaining 17 guard-profile
 * tabs follow. The pattern:
 *   1. Define a zod schema in src/lib/schemas/<feature>.ts mirroring the
 *      legacy field-level validations (no rule changes).
 *   2. Use react-hook-form via shadcn <Form> + <FormField>/<FormItem>/
 *      <FormLabel>/<FormControl>/<FormMessage>.
 *   3. Wrap legacy specialty inputs (e.g. CnicInput, PhoneInput) inside
 *      <FormControl> with field.value/onChange wiring — DO NOT rewrite their
 *      async/format logic.
 *   4. Two-column grid layout (grid grid-cols-2 gap-6) for the form body.
 *   5. Required fields use <FormLabel> with a red asterisk.
 *   6. On submit, hit the existing API endpoint and surface envelope errors via
 *      toast.error(data.message). Use toast.success on 2xx.
 *   7. Read-only sections (display) live below the editable form card.
 */

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import {
    User,
    Phone,
    MapPin,
    Building,
    Briefcase,
    BookOpen,
    UserCheck,
    Activity,
    CalendarIcon,
    Loader2,
} from "lucide-react"

import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/shadcn/form"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/shadcn/select"
import { Button } from "@/components/shadcn/button"
import { Calendar } from "@/components/shadcn/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/shadcn/popover"
import { cn } from "@/lib/utils"

import CnicInput from "@/components/ui/CnicInput"
import PhoneInput from "@/components/ui/PhoneInput"

import {
    guardPersonalSchema,
    type GuardPersonalInput,
} from "@/lib/schemas/guard-personal"
import type {
    GuardTabModel,
    NearestRelative,
    FamilyMember,
} from "@/components/guards/tabs/types"

interface GeneralInformationProps {
    guard: GuardTabModel
    canUpdate?: boolean
}

function InfoField({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="font-medium text-gray-900">{value || "—"}</p>
        </div>
    )
}

function RequiredMark() {
    return <span className="text-red-500 ml-0.5">*</span>
}

function toIsoDate(value?: string | Date | null): string {
    if (!value) return ""
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return ""
    return d.toISOString().slice(0, 10)
}

export default function GeneralInformationTab({ guard, canUpdate = false }: GeneralInformationProps) {
    const router = useRouter()
    const [submitting, setSubmitting] = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    const form = useForm<GuardPersonalInput>({
        resolver: zodResolver(guardPersonalSchema),
        defaultValues: {
            name: guard.name || "",
            cnic: guard.cnic || "",
            phone: guard.phone || "",
            email: guard.email || "",
            dateOfBirth: toIsoDate(guard.dateOfBirth),
            fatherName: guard.fatherName || "",
            motherName: guard.motherName || "",
            religion: guard.religion || "",
            maritalStatus:
                (guard.maritalStatus as GuardPersonalInput["maritalStatus"]) || "",
            nationality: guard.nationality || "",
            addressCurrent: guard.addressCurrent || "",
            addressPermanent: guard.addressPermanent || "",
            emergencyContact: guard.emergencyContact || "",
        },
    })

    const onSubmit = async (values: GuardPersonalInput) => {
        if (!guard.id) return
        setSubmitting(true)
        try {
            const res = await fetch(`/api/guards/${guard.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })
            const data = (await res.json().catch(() => ({}))) as {
                message?: string
                success?: boolean
            }
            if (!res.ok) {
                // Error envelope is { success: false, message, code } — read .message
                toast.error(data.message || "Failed to update personal details")
                return
            }
            toast.success("Personal details updated")
            setIsEditing(false)
            router.refresh()
        } catch {
            toast.error("Network error — please try again")
        } finally {
            setSubmitting(false)
        }
    }

    const formatDate = (date?: Date | string | null) => {
        if (!date) return "—"
        return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    }

    const formatTime = (date?: Date | string | null) => {
        if (!date) return "—"
        const d = new Date(date)
        return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    }

    const calculateCurrentAge = (dob?: Date | string | null): string | null => {
        if (!dob) return null
        const birth = new Date(dob)
        const today = new Date()
        let years = today.getFullYear() - birth.getFullYear()
        const m = today.getMonth() - birth.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--
        return `${years} years`
    }

    const nearestRelativeList = Array.isArray(guard.nearestRelatives) ? guard.nearestRelatives : []
    const familyMemberList = Array.isArray(guard.familyMembers) ? guard.familyMembers : []

    // Previous employment label
    const exType = guard.exServiceType || (guard.isExService ? "OTHER" : "CIVILIAN")
    const isPreviouslyServed = ["ARMY", "POLICE", "RANGERS", "MUJAHID", "OTHER"].includes(exType)
    const exLabel = exType === "OTHER" ? (guard.exServiceOtherLabel || "Other") : exType

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">General Information</h2>
                {canUpdate && !isEditing && (
                    <Button type="button" onClick={() => setIsEditing(true)}>
                        Edit
                    </Button>
                )}
            </div>

            {/* Editable Personal Information — canonical Form pattern */}
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="bg-white rounded-lg border p-6 space-y-6"
                >
                    <div className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        <h3 className="text-lg font-semibold">Personal Information</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Parwest ID — read-only, not bound to a form field */}
                        <div className="space-y-2">
                            <Label>Parwest ID</Label>
                            <Input value={guard.parwestId || ""} disabled />
                        </div>

                        {/* Full Name */}
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Full Name<RequiredMark />
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter full name" {...field} disabled={!isEditing} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* CNIC — wraps legacy CnicInput so async uniqueness/format checks are preserved */}
                        <FormField
                            control={form.control}
                            name="cnic"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        CNIC<RequiredMark />
                                    </FormLabel>
                                    <FormControl>
                                        <div
                                            onChange={(e: React.ChangeEvent<HTMLDivElement>) => {
                                                const target = e.target as HTMLInputElement
                                                if (target?.name === "cnic") field.onChange(target.value)
                                            }}
                                            onBlur={field.onBlur}
                                        >
                                            <CnicInput
                                                name="cnic"
                                                required
                                                defaultValue={field.value}
                                                uniqueCheckUrl="/api/guards/check-cnic"
                                                excludeGuardId={guard.id}
                                                disabled={!isEditing}
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Phone — wraps legacy PhoneInput */}
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone</FormLabel>
                                    <FormControl>
                                        <div
                                            onChange={(e: React.ChangeEvent<HTMLDivElement>) => {
                                                const target = e.target as HTMLInputElement
                                                if (target?.name === "phone") field.onChange(target.value)
                                            }}
                                            onBlur={field.onBlur}
                                        >
                                            <PhoneInput
                                                name="phone"
                                                defaultValue={field.value || ""}
                                                disabled={!isEditing}
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Email */}
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="name@example.com" {...field} disabled={!isEditing} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Date of Birth — shadcn Calendar inside Popover */}
                        <FormField
                            control={form.control}
                            name="dateOfBirth"
                            render={({ field }) => {
                                const dateValue = field.value ? new Date(field.value) : undefined
                                const valid = dateValue && !Number.isNaN(dateValue.getTime())
                                return (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>
                                            Date of Birth<RequiredMark />
                                        </FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        disabled={!isEditing}
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal",
                                                            !valid && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {valid ? format(dateValue, "PPP") : "Pick a date"}
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={valid ? dateValue : undefined}
                                                    onSelect={(d) =>
                                                        field.onChange(d ? format(d, "yyyy-MM-dd") : "")
                                                    }
                                                    captionLayout="dropdown"
                                                    fromYear={1940}
                                                    toYear={new Date().getFullYear()}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )
                            }}
                        />

                        {/* Father's Name */}
                        <FormField
                            control={form.control}
                            name="fatherName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Father&apos;s Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled={!isEditing} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Mother's Name */}
                        <FormField
                            control={form.control}
                            name="motherName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mother&apos;s Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled={!isEditing} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Religion */}
                        <FormField
                            control={form.control}
                            name="religion"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Religion</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled={!isEditing} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Marital Status — shadcn Select */}
                        <FormField
                            control={form.control}
                            name="maritalStatus"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Marital Status</FormLabel>
                                    <Select
                                        value={field.value || ""}
                                        onValueChange={field.onChange}
                                        disabled={!isEditing}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="SINGLE">Single</SelectItem>
                                            <SelectItem value="MARRIED">Married</SelectItem>
                                            <SelectItem value="DIVORCED">Divorced</SelectItem>
                                            <SelectItem value="WIDOWED">Widowed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Nationality */}
                        <FormField
                            control={form.control}
                            name="nationality"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nationality</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled={!isEditing} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Emergency Contact */}
                        <FormField
                            control={form.control}
                            name="emergencyContact"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Emergency Contact</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled={!isEditing} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Current Address */}
                        <FormField
                            control={form.control}
                            name="addressCurrent"
                            render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Current Address</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled={!isEditing} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Permanent Address */}
                        <FormField
                            control={form.control}
                            name="addressPermanent"
                            render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Permanent Address</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled={!isEditing} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {isEditing ? (
                        <div className="flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => { form.reset(); setIsEditing(false) }}
                                disabled={submitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </div>
                    ) : null}
                </form>
            </Form>

            {/* Read-only display sections (preserved from legacy view) */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Additional Personal Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="CNIC Issue Date" value={formatDate(guard.cnicIssueDate)} />
                    <InfoField label="CNIC Expiry Date" value={formatDate(guard.cnicExpiryDate)} />
                    <InfoField label="Current Age" value={calculateCurrentAge(guard.dateOfBirth)} />
                    <InfoField label="Sect" value={guard.sect} />
                    <InfoField label="Cast" value={guard.cast} />
                    <InfoField label="Blood Group" value={guard.bloodGroup} />
                    <InfoField label="Next of Kin" value={guard.nextOfKin} />
                    <InfoField label="Police Station" value={guard.policeStation} />
                    <InfoField label="Profile Introducer" value={guard.profileIntroducer} />
                    <InfoField label="Enrolled By" value={guard.enrolledBy} />
                    <InfoField label="Enrolled Date" value={formatDate(guard.createdAt)} />
                    <InfoField label="Enrolled Time" value={formatTime(guard.createdAt)} />
                </div>
            </div>

            {/* Contact Information (additional) */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Additional Contact Numbers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="md:col-span-2 lg:col-span-3">
                        <InfoField label="Additional Contact Numbers" value={guard.additionalContactNumbers || guard.phoneSecondary} />
                    </div>
                </div>
            </div>

            {/* Address Information additional contacts */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Address Contacts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoField label="Current Address Contact" value={guard.currentAddressContact} />
                    <InfoField label="Permanent Address Contact" value={guard.permanentAddressContact} />
                </div>
            </div>

            {/* Parwest Employment */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Parwest Employment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="Regional Office" value={typeof guard.regionalOffice === "string" ? guard.regionalOffice : guard.regionalOffice?.name} />
                    <InfoField label="Designation" value={guard.designation} />
                    <InfoField label="Salary" value={guard.salary != null ? `PKR ${guard.salary.toLocaleString()}` : null} />
                    <InfoField label="Supervisor" value={guard.managerName} />
                    <InfoField label="Enrolled By" value={guard.enrolledBy} />
                    <InfoField label="Joining Date" value={formatDate(guard.joiningDate)} />
                    <InfoField label="Joining Age" value={guard.joiningAge != null ? `${guard.joiningAge} years` : null} />
                </div>
            </div>

            {/* Previous Employment */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Previous Employment
                </h3>
                {(() => {
                    const multiEntries = Array.isArray(guard.previousEmployments) && guard.previousEmployments.length > 0
                        ? guard.previousEmployments
                        : null

                    const entries = multiEntries ?? (isPreviouslyServed ? [{
                        type: exLabel,
                        isExService: true,
                        registrationNo: guard.exServiceRegistrationNo,
                        rank: guard.exServiceRank,
                        unit: guard.exServiceUnit || guard.exServiceRegiment,
                        dateOfEnrollment: guard.dateOfEnrollment ? String(guard.dateOfEnrollment) : null,
                        dateOfDischarge: guard.dateOfDischarge ? String(guard.dateOfDischarge) : null,
                        years: guard.exServiceYears,
                        months: guard.exServiceMonths,
                        remarks: guard.exServiceRemarks,
                    }] : [])

                    if (entries.length === 0) {
                        return (
                            <div className="flex items-center gap-2 rounded-md bg-gray-50 border px-4 py-3">
                                <span className="text-sm font-medium text-gray-700">Type:</span>
                                <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-sm font-medium">Civilian</span>
                            </div>
                        )
                    }

                    return (
                        <div className="space-y-6">
                            {entries.map((emp, idx) => {
                                const yearsNum = emp.years != null ? parseInt(String(emp.years)) : null
                                const monthsNum = emp.months != null ? parseInt(String(emp.months)) : null
                                const serviceDuration = [
                                    yearsNum ? `${yearsNum} year${yearsNum !== 1 ? "s" : ""}` : null,
                                    monthsNum ? `${monthsNum} month${monthsNum !== 1 ? "s" : ""}` : null,
                                ].filter(Boolean).join(" ") || null

                                const enrollDate = formatDate(emp.dateOfEnrollment)
                                const dischargeDate = formatDate(emp.dateOfDischarge)
                                const servicePeriod = enrollDate !== "—" || dischargeDate !== "—"
                                    ? `${enrollDate} → ${dischargeDate}`
                                    : null

                                const isCivilian = emp.type === "CIVILIAN" || emp.isExService === false
                                const empLoose = emp as Record<string, unknown>

                                return (
                                    <div key={idx} className={entries.length > 1 ? "rounded-md border p-4" : ""}>
                                        {entries.length > 1 && (
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Employment {idx + 1}</p>
                                        )}
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-sm font-medium text-gray-700">Employment Type:</span>
                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${isCivilian ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                                                {emp.type || "—"}
                                            </span>
                                        </div>
                                        {isCivilian ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <InfoField label="Company Name" value={empLoose.nameOfCompany as string | null | undefined} />
                                                <InfoField label="Designation" value={empLoose.designation as string | null | undefined} />
                                                <InfoField label="Service Period" value={servicePeriod} />
                                                <InfoField label="Duration" value={serviceDuration} />
                                                <InfoField label="Reason for Leaving" value={empLoose.reasonForLeaving as string | null | undefined} />
                                                <InfoField label="Remarks" value={emp.remarks} />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <InfoField label="Registration No" value={emp.registrationNo} />
                                                <InfoField label="Rank" value={emp.rank} />
                                                <InfoField label="Unit / Regiment" value={emp.unit} />
                                                <InfoField label="Service Period" value={servicePeriod} />
                                                <InfoField label="Duration of Service" value={serviceDuration} />
                                                <InfoField label="Remarks" value={emp.remarks} />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )
                })()}
            </div>

            {/* Education */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Education
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="Education Level" value={guard.education} />
                    <InfoField label="Passing Year" value={guard.passingYear} />
                    <InfoField label="Institute" value={guard.educationInstitute} />
                </div>
            </div>

            {/* Physical Details */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Physical Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="Height" value={guard.height} />
                    <InfoField label="Weight" value={guard.weight} />
                    <InfoField label="Eye Color" value={guard.eyeColor} />
                    <InfoField label="Hair Color" value={guard.hairColor} />
                    <InfoField label="Disability" value={guard.disability} />
                    <InfoField label="Mark of Identification" value={guard.identificationMark} />
                </div>
            </div>

            {/* Introducer */}
            {(guard.introducerName || guard.introducerCnic) ? (
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <UserCheck className="h-5 w-5" />
                        Introducer
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <InfoField label="Full Name" value={guard.introducerName} />
                        <InfoField label="CNIC" value={guard.introducerCnic} />
                        <InfoField label="Contact" value={guard.introducerContact} />
                        <div className="md:col-span-2">
                            <InfoField label="Address" value={guard.introducerAddress} />
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Family Members */}
            {familyMemberList.length > 0 ? (
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold mb-4">Family Members</h3>
                    <div className="space-y-3">
                        {familyMemberList.map((member: FamilyMember, i: number) => (
                            <div key={i} className="rounded-md border p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                <InfoField label="Name" value={member.name} />
                                <InfoField label="Relation" value={member.relation} />
                                <InfoField label="Age" value={member.age} />
                                <InfoField label="Profession" value={member.profession} />
                                {member.address ? <div className="md:col-span-2 lg:col-span-4"><InfoField label="Address" value={member.address} /></div> : null}
                                {member.childCnic ? <InfoField label="Child CNIC / B-Form" value={member.childCnic} /> : null}
                                {member.childAge ? <InfoField label="Child Age" value={member.childAge} /> : null}
                                {member.childDob ? <InfoField label="Child DOB" value={member.childDob} /> : null}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Nearest Relatives */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">Nearest Relative Details</h3>
                {nearestRelativeList.length === 0 ? (
                    <p className="text-sm text-gray-600">No nearest relative details available.</p>
                ) : (
                    <div className="space-y-4">
                        {nearestRelativeList.map((relative: NearestRelative, index: number) => (
                            <div key={`${relative.name || "relative"}-${index}`} className="rounded-md border p-4">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                                    <InfoField label="Name" value={relative.name} />
                                    <InfoField label="Father Name" value={relative.fatherName} />
                                    <InfoField label="Relation" value={relative.relation} />
                                    <InfoField label="Profession" value={relative.profession} />
                                    <InfoField label="CNIC" value={relative.cnic} />
                                    <InfoField label="Contact" value={relative.contact} />
                                    <div className="md:col-span-2">
                                        <InfoField label="Address" value={relative.address} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
