"use client"

import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Plus, Trash2, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"
import GuardAccountsEditor, { emptyBankAccount } from "@/components/guards/GuardAccountsEditor"
import ProfileImageCard from "@/components/guards/ProfileImageCard"
import CnicInput from "@/components/ui/CnicInput"
import { isValidGuardAge } from "@/lib/validation/formats"
import type { FamilyMember, NearestRelative } from "@/components/guards/tabs/types"
import type { BankAccountInput } from "@/lib/schemas/guard-edit"

import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/shadcn/form"
import { Input } from "@/components/shadcn/input"
import { Textarea } from "@/components/shadcn/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/shadcn/select"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/shadcn/alert-dialog"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import { guardEditSchema, type GuardEditForm } from "@/lib/schemas/guard-edit"

type PreviousEmployment = {
    type: string           // ex-service type name or "CIVILIAN"
    isExService: boolean
    registrationNo?: string
    rank?: string
    unit?: string
    dateOfEnrollment?: string
    dateOfDischarge?: string
    years?: string
    months?: string
    remarks?: string
}

type Guard = {
    id: string
    parwestId: string
    name: string
    cnic: string
    phone: string | null
    email: string | null
    dateOfBirth: Date | null
    age: number | null
    fatherName: string | null
    motherName: string | null
    religion: string | null
    maritalStatus: string | null
    education: string | null
    nationality: string | null
    nextOfKin: string | null
    profileIntroducer: string | null
    addressPermanent: string | null
    addressCurrent: string | null
    emergencyContact: string | null
    additionalContactNumbers: string | null
    nearestRelativesJson: string | null
    familyMembersJson?: string | null
    previousEmploymentsJson?: string | null
    regionId: string | null
    regionalOfficeId: string | null
    joiningDate: Date | null
    status: string
    lifecycleStatus?: string | null
    isExService: boolean
    exServiceType: string | null
    exServiceRank: string | null
    exServiceRegiment: string | null
    bankName: string | null
    bankAccountNumber: string | null
    bankAccountType: string | null
    bankAccountsJson?: string | null
    paymentMode?: string | null
    guardCategory?: string | null
    photoUrl?: string | null
}

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
    guard: Guard
    regions: Region[]
    regionalOffices: RegionalOffice[]
    currentSupervisorId: string | null
    lockedRegionId?: string | null
    lockedRegionalOfficeId?: string | null
}

function RequiredMark() {
    return <span className="text-red-500 ml-0.5">*</span>
}

const emptyEmployment = (): PreviousEmployment => ({
    type: "CIVILIAN",
    isExService: false,
    registrationNo: "",
    rank: "",
    unit: "",
    dateOfEnrollment: "",
    dateOfDischarge: "",
    years: "",
    months: "",
    remarks: "",
})

function PreviousEmploymentEditor({
    defaultJson,
    defaultEmploymentType,
    onDirtyChange,
}: {
    defaultJson: string | null | undefined
    defaultEmploymentType: string
    onDirtyChange?: (dirty: boolean) => void
}) {
    const [employments, setEmployments] = useState<PreviousEmployment[]>(() => {
        if (!defaultJson) return []
        try {
            const parsed = JSON.parse(defaultJson)
            return Array.isArray(parsed) ? parsed : []
        } catch { return [] }
    })
    const [exServiceTypes, setExServiceTypes] = useState<string[]>([])
    const [guardEmploymentType, setGuardEmploymentType] = useState<string>(defaultEmploymentType || "")

    useEffect(() => {
        fetch("/api/guard-ex-service-types?activeOnly=true")
            .then((r) => r.ok ? r.json() : [])
            .then((data: Array<{ name: string }>) => setExServiceTypes(data.map((d) => d.name)))
            .catch(() => setExServiceTypes([]))
    }, [])

    const markDirty = () => onDirtyChange?.(true)
    const addEntry = () => { setEmployments((prev) => [...prev, emptyEmployment()]); markDirty() }
    const removeEntry = (i: number) => { setEmployments((prev) => prev.filter((_, idx) => idx !== i)); markDirty() }
    const updateEntry = (i: number, patch: Partial<PreviousEmployment>) => {
        setEmployments((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
        markDirty()
    }

    const handleTypeChange = (i: number, value: string) => {
        const isExService = value !== "CIVILIAN"
        updateEntry(i, { type: value, isExService })
    }

    const handleGuardEmploymentTypeChange = (next: string) => {
        setGuardEmploymentType(next)
        markDirty()
        if (next && next !== "CIVILIAN") {
            // Seed a matching ex-service row so the user can immediately fill in
            // Registration No / Rank / Unit.
            setEmployments((prev) =>
                prev.some((e) => e.type === next)
                    ? prev
                    : [...prev, { ...emptyEmployment(), type: next, isExService: true }]
            )
        }
    }

    return (
        <section className="space-y-3">
            <input type="hidden" name="previousEmploymentsJson" value={JSON.stringify(employments)} />
            <input type="hidden" name="exServiceType" value={guardEmploymentType} />
            <input type="hidden" name="isExService" value={guardEmploymentType && guardEmploymentType !== "CIVILIAN" ? "true" : "false"} />

            {/* Top-level guard employment type — drives PBA SA-10 vs SA-11 */}
            <div className="rounded-md border bg-muted/30 p-4">
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Guard Employment Type <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="radio"
                            checked={guardEmploymentType === "CIVILIAN"}
                            onChange={() => handleGuardEmploymentTypeChange("CIVILIAN")}
                            className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">Civilian</span>
                    </label>
                    {exServiceTypes.map((t) => (
                        <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="radio"
                                checked={guardEmploymentType === t}
                                onChange={() => handleGuardEmploymentTypeChange(t)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm">{t}</span>
                        </label>
                    ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    {guardEmploymentType === "CIVILIAN"
                        ? "Civilian — adding previous employment records is optional."
                        : guardEmploymentType
                        ? `${guardEmploymentType} — at least one ${guardEmploymentType} record with Registration No, Rank, and Unit is required.`
                        : "Required. Determines applicable PBA documents (SA-10 for ex-service, SA-11 for civilian)."}
                </p>
            </div>

            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Previous Employment Details</h3>
                <Button type="button" variant="outline" size="sm" onClick={addEntry}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Employment
                </Button>
            </div>

            {employments.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No previous employment added. If civilian, leave empty. Click &quot;Add Employment&quot; to add ex-service details.</p>
            )}

            <div className="space-y-4">
                {employments.map((emp, idx) => (
                    <div key={idx} className="rounded-md border p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Employment {idx + 1}</p>
                            <button
                                type="button"
                                onClick={() => removeEntry(idx)}
                                className="text-sm text-red-600 hover:underline flex items-center gap-1"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Remove
                            </button>
                        </div>

                        {/* Type selection */}
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-2">Service Type</label>
                            <div className="flex flex-wrap gap-3">
                                {exServiceTypes.map((t) => (
                                    <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={emp.type === t}
                                            onChange={() => handleTypeChange(idx, t)}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-sm">{t}</span>
                                    </label>
                                ))}
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={emp.type === "CIVILIAN"}
                                        onChange={() => handleTypeChange(idx, "CIVILIAN")}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm">CIVILIAN</span>
                                </label>
                            </div>
                        </div>

                        {/* Ex-service fields (only when not civilian) */}
                        {emp.isExService && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Registration No</label>
                                    <Input className="tabular-nums" placeholder="Registration No" value={emp.registrationNo || ""} onChange={(e) => updateEntry(idx, { registrationNo: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Rank</label>
                                    <Input placeholder="Rank" value={emp.rank || ""} onChange={(e) => updateEntry(idx, { rank: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Unit</label>
                                    <Input placeholder="Unit" value={emp.unit || ""} onChange={(e) => updateEntry(idx, { unit: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Date of Enrollment</label>
                                    <Input type="date" value={emp.dateOfEnrollment || ""} onChange={(e) => updateEntry(idx, { dateOfEnrollment: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Date of Discharge</label>
                                    <Input type="date" value={emp.dateOfDischarge || ""} onChange={(e) => updateEntry(idx, { dateOfDischarge: e.target.value })} />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">Years</label>
                                        <Input type="number" className="tabular-nums" placeholder="Years" value={emp.years || ""} onChange={(e) => updateEntry(idx, { years: e.target.value })} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">Months</label>
                                        <Input type="number" className="tabular-nums" placeholder="Months" value={emp.months || ""} onChange={(e) => updateEntry(idx, { months: e.target.value })} />
                                    </div>
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Remarks</label>
                                    <Input placeholder="Remarks" value={emp.remarks || ""} onChange={(e) => updateEntry(idx, { remarks: e.target.value })} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}

const emptyRelative = (): NearestRelative => ({
    name: "",
    fatherName: "",
    relation: "",
    profession: "",
    cnic: "",
    contact: "",
    address: "",
})

function NearestRelativesEditor({
    defaultJson,
    onDirtyChange,
}: {
    defaultJson: string | null
    onDirtyChange?: (dirty: boolean) => void
}) {
    const [relatives, setRelatives] = useState<NearestRelative[]>(() => {
        if (!defaultJson) return []
        try {
            const parsed = JSON.parse(defaultJson)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    })

    const markDirty = () => onDirtyChange?.(true)
    const addRelative = () => { setRelatives((prev) => [...prev, emptyRelative()]); markDirty() }

    const removeRelative = (index: number) => { setRelatives((prev) => prev.filter((_, i) => i !== index)); markDirty() }

    const updateRelative = (index: number, patch: Partial<NearestRelative>) => {
        setRelatives((prev) =>
            prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
        )
        markDirty()
    }

    return (
        <section className="space-y-3">
            <input type="hidden" name="nearestRelativesJson" value={JSON.stringify(relatives)} />

            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Nearest Relatives</h3>
                <Button type="button" variant="outline" size="sm" onClick={addRelative}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Relative
                </Button>
            </div>

            {relatives.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No relatives added. Click &quot;Add Relative&quot; to add one.</p>
            )}

            <div className="space-y-4">
                {relatives.map((rel, index) => (
                    <div key={index} className="rounded-md border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Relative {index + 1}</p>
                            <button
                                type="button"
                                onClick={() => removeRelative(index)}
                                className="text-sm text-red-600 hover:underline flex items-center gap-1"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                                <Input
                                    placeholder="Full name"
                                    value={rel.name || ""}
                                    onChange={(e) => updateRelative(index, { name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Father Name</label>
                                <Input
                                    placeholder="Father name"
                                    value={rel.fatherName || ""}
                                    onChange={(e) => updateRelative(index, { fatherName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Relation</label>
                                <Input
                                    placeholder="e.g. Brother, Father, Wife"
                                    value={rel.relation || ""}
                                    onChange={(e) => updateRelative(index, { relation: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Profession</label>
                                <Input
                                    placeholder="Profession"
                                    value={rel.profession || ""}
                                    onChange={(e) => updateRelative(index, { profession: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">CNIC</label>
                                <Input
                                    className="tabular-nums"
                                    placeholder="XXXXX-XXXXXXX-X"
                                    value={rel.cnic || ""}
                                    onChange={(e) => updateRelative(index, { cnic: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Contact</label>
                                <Input
                                    className="tabular-nums"
                                    placeholder="03XX-XXXXXXX"
                                    value={rel.contact || ""}
                                    onChange={(e) => updateRelative(index, { contact: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
                                <Input
                                    placeholder="Full address"
                                    value={rel.address || ""}
                                    onChange={(e) => updateRelative(index, { address: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

const emptyFamilyMember = (): FamilyMember => ({
    name: "",
    relation: "",
    age: "",
    profession: "",
    address: "",
    childCnic: "",
    childAge: "",
    childDob: "",
})

function FamilyMembersEditor({
    defaultJson,
    onDirtyChange,
}: {
    defaultJson: string | null
    onDirtyChange?: (dirty: boolean) => void
}) {
    const [members, setMembers] = useState<FamilyMember[]>(() => {
        if (!defaultJson) return []
        try {
            const parsed = JSON.parse(defaultJson)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    })

    const markDirty = () => onDirtyChange?.(true)
    const addMember = () => { setMembers((prev) => [...prev, emptyFamilyMember()]); markDirty() }

    const removeMember = (index: number) => { setMembers((prev) => prev.filter((_, i) => i !== index)); markDirty() }

    const updateMember = (index: number, patch: Partial<FamilyMember>) => {
        setMembers((prev) =>
            prev.map((m, i) => (i === index ? { ...m, ...patch } : m))
        )
        markDirty()
    }

    return (
        <section id="family-members" className="space-y-3 scroll-mt-24">
            <input type="hidden" name="familyMembersJson" value={JSON.stringify(members)} />

            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Family Members</h3>
                <Button type="button" variant="outline" size="sm" onClick={addMember}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Family Member
                </Button>
            </div>

            {members.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No family members added. Click &quot;Add Family Member&quot; to add one.</p>
            )}

            <div className="space-y-4">
                {members.map((member, index) => (
                    <div key={index} className="rounded-md border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Family Member {index + 1}</p>
                            <button
                                type="button"
                                onClick={() => removeMember(index)}
                                className="text-sm text-red-600 hover:underline flex items-center gap-1"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                                <Input
                                    placeholder="Full name"
                                    value={member.name || ""}
                                    onChange={(e) => updateMember(index, { name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Relation</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={member.relation || ""}
                                    onChange={(e) => updateMember(index, { relation: e.target.value })}
                                >
                                    <option value="">Select relation</option>
                                    <option value="Father">Father</option>
                                    <option value="Mother">Mother</option>
                                    <option value="Spouse">Spouse</option>
                                    <option value="Brother">Brother</option>
                                    <option value="Sister">Sister</option>
                                    <option value="Son">Son</option>
                                    <option value="Daughter">Daughter</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Age</label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="120"
                                    className="tabular-nums"
                                    placeholder="Age"
                                    value={member.age || ""}
                                    onChange={(e) => updateMember(index, { age: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Profession</label>
                                <Input
                                    placeholder="Profession"
                                    value={member.profession || ""}
                                    onChange={(e) => updateMember(index, { profession: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Child CNIC (if applicable)</label>
                                <Input
                                    className="tabular-nums"
                                    placeholder="XXXXX-XXXXXXX-X"
                                    value={member.childCnic || ""}
                                    onChange={(e) => updateMember(index, { childCnic: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Child Age</label>
                                <Input
                                    type="number"
                                    min="0"
                                    className="tabular-nums"
                                    placeholder="Child age"
                                    value={member.childAge || ""}
                                    onChange={(e) => updateMember(index, { childAge: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Child Date of Birth</label>
                                <Input
                                    type="date"
                                    value={member.childDob || ""}
                                    onChange={(e) => updateMember(index, { childDob: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
                                <Input
                                    placeholder="Full address"
                                    value={member.address || ""}
                                    onChange={(e) => updateMember(index, { address: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

export default function GuardEditForm({ guard, regions, regionalOffices, currentSupervisorId, lockedRegionId = null, lockedRegionalOfficeId = null }: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [loading, setLoading] = useState(false)
    const [subEditorsDirty, setSubEditorsDirty] = useState(false)

    // Dynamic supervisor list based on selected regional office
    const initialOfficeId = lockedRegionalOfficeId || guard.regionalOfficeId || ""
    const [selectedRegionalOfficeId, setSelectedRegionalOfficeId] = useState(initialOfficeId)
    const [supervisors, setSupervisors] = useState<Array<{ id: string; name: string; email: string }>>([])
    const [supervisorsLoading, setSupervisorsLoading] = useState(false)

    const formatDateForInput = (date: Date | null) => {
        if (!date) return ""
        return new Date(date).toISOString().split("T")[0]
    }

    // Derive initial bank accounts from JSON, falling back to legacy flat
    // fields so guards saved pre-JSON still hydrate correctly.
    const initialBankAccounts: BankAccountInput[] = (() => {
        try {
            const parsed = JSON.parse(guard.bankAccountsJson || "[]")
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((p: Partial<BankAccountInput>) => ({
                    ...emptyBankAccount(),
                    ...p,
                }))
            }
        } catch { /* ignore */ }
        if (guard.bankName || guard.bankAccountNumber) {
            return [{
                ...emptyBankAccount(),
                id: "legacy-primary",
                bankName: guard.bankName || "",
                accountNumber: guard.bankAccountNumber || "",
                accountType: (guard.bankAccountType === "Current" ? "CURRENT" : "SAVINGS") as "SAVINGS" | "CURRENT",
                isActive: true,
            }]
        }
        return [{ ...emptyBankAccount(), isActive: true }]
    })()

    const form = useForm<GuardEditForm>({
        resolver: zodResolver(guardEditSchema),
        defaultValues: {
            name: guard.name || "",
            cnic: guard.cnic || "",
            dateOfBirth: formatDateForInput(guard.dateOfBirth),
            age: guard.age != null ? String(guard.age) : "",
            fatherName: guard.fatherName || "",
            motherName: guard.motherName || "",
            religion: guard.religion || "",
            maritalStatus: guard.maritalStatus || "",
            education: guard.education || "",
            nationality: guard.nationality || "",
            nextOfKin: guard.nextOfKin || "",
            profileIntroducer: guard.profileIntroducer || "",
            phone: guard.phone || "",
            email: guard.email || "",
            emergencyContact: guard.emergencyContact || "",
            additionalContactNumbers: guard.additionalContactNumbers || "",
            addressPermanent: guard.addressPermanent || "",
            addressCurrent: guard.addressCurrent || "",
            regionId: guard.regionId || "",
            regionalOfficeId: guard.regionalOfficeId || "",
            joiningDate: formatDateForInput(guard.joiningDate),
            lifecycleStatus: ((): "PENDING" | "ACTIVE" | "INACTIVE" | "TERMINATED" => {
                const v = String(guard.lifecycleStatus ?? "").toUpperCase()
                if (v === "PENDING" || v === "ACTIVE" || v === "INACTIVE" || v === "TERMINATED") return v
                return "PENDING"
            })(),
            paymentMode: guard.paymentMode || "BANK",
            guardCategory: guard.guardCategory || "REGULAR",
            supervisorId: currentSupervisorId || "",
            bankAccounts: initialBankAccounts,
        },
    })

    useEffect(() => {
        if (!selectedRegionalOfficeId) { setSupervisors([]); return }
        setSupervisorsLoading(true)
        const params = new URLSearchParams({ status: "ACTIVE", regionalOfficeId: selectedRegionalOfficeId })
        if (lockedRegionId) params.set("regionId", lockedRegionId)
        fetch(`/api/users?${params.toString()}`)
            .then((r) => r.ok ? r.json() : [])
            .then((data: Array<{ id: string; name: string; email: string }>) => setSupervisors(data))
            .catch(() => setSupervisors([]))
            .finally(() => setSupervisorsLoading(false))
    }, [selectedRegionalOfficeId, lockedRegionId])

    const onSubmit = async (values: GuardEditForm) => {
        // Pull sub-editor JSON values from hidden inputs in the form
        const formEl = formRef.current
        if (!formEl) return
        const formData = new FormData(formEl)
        const previousEmploymentsJson = String(formData.get("previousEmploymentsJson") || "[]")
        const exServiceType = String(formData.get("exServiceType") || "")
        const isExService = String(formData.get("isExService") || "false")
        const nearestRelativesJson = String(formData.get("nearestRelativesJson") || "")
        const familyMembersJson = String(formData.get("familyMembersJson") || "")
        // bankAccounts is now part of RHF state (useFieldArray) — serialize
        // from values directly to preserve the legacy stringified-JSON
        // contract expected by PUT /api/guards/[id].
        const bankAccounts = JSON.stringify(values.bankAccounts ?? [])

        // Preserve client-side validations from the legacy onSubmit handler
        const dobForAge = String(values.dateOfBirth || "").trim()
        if (dobForAge && !isValidGuardAge(dobForAge)) {
            toast.error("Guard must be between 18 and 65 years old.")
            return
        }

        const guardEmploymentType = exServiceType.trim()
        if (!guardEmploymentType) {
            toast.error("Guard Employment Type is required.")
            return
        }
        type RowShape = { type?: string; registrationNo?: string; rank?: string; unit?: string }
        let rows: RowShape[] = []
        try { rows = JSON.parse(previousEmploymentsJson) } catch { rows = [] }
        if (rows.some((r) => !String(r.type || "").trim())) {
            toast.error("Each previous employment record must have an Employment Type selected.")
            return
        }
        if (guardEmploymentType !== "CIVILIAN") {
            const matching = rows.filter((r) => r.type === guardEmploymentType)
            if (matching.length === 0) {
                toast.error(`At least one previous employment record with type ${guardEmploymentType} is required.`)
                return
            }
            const incomplete = matching.find(
                (r) => !String(r.registrationNo || "").trim() || !String(r.rank || "").trim() || !String(r.unit || "").trim()
            )
            if (incomplete) {
                toast.error(`${guardEmploymentType} employment record requires Registration No, Rank, and Unit.`)
                return
            }
        }

        // Build payload — preserve original API contract (flat object with hidden JSON fields)
        const payload: Record<string, unknown> = {
            ...values,
            previousEmploymentsJson,
            exServiceType,
            isExService,
            nearestRelativesJson,
            familyMembersJson,
            bankAccounts,
        }

        // Locked region/office overrides
        if (lockedRegionId) payload.regionId = lockedRegionId
        if (lockedRegionalOfficeId) payload.regionalOfficeId = lockedRegionalOfficeId

        setLoading(true)
        try {
            const response = await fetch(`/api/guards/${guard.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const data = (await response.json().catch(() => ({}))) as { message?: string }
            if (!response.ok) {
                toast.error(data.message || "Failed to update guard")
                return
            }

            toast.success("Guard updated")
            router.push(`/guards/${guard.id}`)
            router.refresh()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Unexpected error")
        } finally {
            setLoading(false)
        }
    }

    const applyOcrFields = (fields: Record<string, string>) => {
        const formEl = formRef.current
        if (!formEl) return
        // Update RHF-managed scalars where field name matches; fall back to native input mutation otherwise
        const rhfFieldNames = new Set(Object.keys(form.getValues()))
        Object.entries(fields).forEach(([name, value]) => {
            if (rhfFieldNames.has(name)) {
                form.setValue(name as keyof GuardEditForm, value, { shouldDirty: true })
            } else {
                const input = formEl.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
                if (input) input.value = value
            }
        })
    }

    const isDirty = form.formState.isDirty || subEditorsDirty
    const cancelHref = `/guards/${guard.id}`

    return (
        <Form {...form}>
            <form
                ref={formRef}
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
            >
                <div>
                    <OcrUploadPanel target="guard" onApply={applyOcrFields} />
                </div>
                <div>
                    <ProfileImageCard guardId={guard.id} guardName={guard.name} initialUrl={guard.photoUrl ?? null} />
                </div>

                {/* Personal Details */}
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Parwest ID is read-only display, not part of the form,
                                so use a plain <label> — FormLabel requires a FormField
                                ancestor (Ticket 38). */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Parwest ID</label>
                                <Input value={guard.parwestId} disabled className="bg-muted/50 tabular-nums" />
                            </div>

                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name<RequiredMark /></FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter full name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="cnic"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CNIC<RequiredMark /></FormLabel>
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
                                                    placeholder="12345-1234567-1"
                                                    defaultValue={guard.cnic}
                                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                    uniqueCheckUrl="/api/guards/check-cnic"
                                                    excludeGuardId={guard.id}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="dateOfBirth"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date of Birth</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                aria-invalid={Boolean(field.value && !isValidGuardAge(field.value))}
                                            />
                                        </FormControl>
                                        {field.value && !isValidGuardAge(field.value) && (
                                            <p className="mt-1 text-[11px] text-red-500">
                                                Guard must be between 18 and 65 years old.
                                            </p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="age"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Age</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={18}
                                                max={65}
                                                placeholder="Age"
                                                className="tabular-nums"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="fatherName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Father&apos;s Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Father's name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="motherName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mother&apos;s Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Mother's name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="religion"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Religion</FormLabel>
                                        <Select value={field.value || ""} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select religion" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Islam">Islam</SelectItem>
                                                <SelectItem value="Christianity">Christianity</SelectItem>
                                                <SelectItem value="Hinduism">Hinduism</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="maritalStatus"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Marital Status</FormLabel>
                                        <Select value={field.value || ""} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Single">Single</SelectItem>
                                                <SelectItem value="Married">Married</SelectItem>
                                                <SelectItem value="Divorced">Divorced</SelectItem>
                                                <SelectItem value="Widowed">Widowed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="education"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Education</FormLabel>
                                        <Select value={field.value || ""} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select education" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Primary">Primary</SelectItem>
                                                <SelectItem value="Middle">Middle</SelectItem>
                                                <SelectItem value="Matric">Matric</SelectItem>
                                                <SelectItem value="Intermediate">Intermediate</SelectItem>
                                                <SelectItem value="Graduate">Graduate</SelectItem>
                                                <SelectItem value="Post-Graduate">Post-Graduate</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="nationality"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nationality</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Pakistani" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="nextOfKin"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Next of Kin</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Next of kin name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="profileIntroducer"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Profile Introducer</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Introducer name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Address & Contact */}
                <Card>
                    <CardHeader>
                        <CardTitle>Address &amp; Contact</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl>
                                            <Input type="tel" placeholder="03XX-XXXXXXX" className="tabular-nums" {...field} />
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
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="guard@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="emergencyContact"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Emergency Contact</FormLabel>
                                        <FormControl>
                                            <Input className="tabular-nums" placeholder="Emergency contact number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="additionalContactNumbers"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Additional Contact Numbers</FormLabel>
                                        <FormControl>
                                            <Input className="tabular-nums" placeholder="e.g. 0311-1234567, 0321-7654321" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="addressPermanent"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Permanent Address</FormLabel>
                                        <FormControl>
                                            <Textarea rows={3} placeholder="Enter permanent address" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="addressCurrent"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Current Address</FormLabel>
                                        <FormControl>
                                            <Textarea rows={3} placeholder="Enter current address" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Service Details */}
                <Card>
                    <CardHeader>
                        <CardTitle>Service Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {lockedRegionId ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Region</label>
                                    <Input
                                        readOnly
                                        value={regions.find((r) => r.id === lockedRegionId)?.name || "Locked region"}
                                        className="bg-muted/50"
                                    />
                                    <p className="text-xs text-muted-foreground">Locked to your assigned region.</p>
                                </div>
                            ) : (
                                <FormField
                                    control={form.control}
                                    name="regionId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Region</FormLabel>
                                            <Select value={field.value || ""} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select region" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {regions.map((region) => (
                                                        <SelectItem key={region.id} value={region.id}>
                                                            {region.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            {lockedRegionalOfficeId ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Regional Office</label>
                                    <Input
                                        readOnly
                                        value={(() => {
                                            const office = regionalOffices.find((o) => o.id === lockedRegionalOfficeId)
                                            return office ? `${office.name} (${office.region.name})` : "Locked regional office"
                                        })()}
                                        className="bg-muted/50"
                                    />
                                    <p className="text-xs text-muted-foreground">Locked to your assigned regional office.</p>
                                </div>
                            ) : (
                                <FormField
                                    control={form.control}
                                    name="regionalOfficeId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Regional Office</FormLabel>
                                            <Select
                                                value={field.value || ""}
                                                onValueChange={(v) => {
                                                    field.onChange(v)
                                                    setSelectedRegionalOfficeId(v)
                                                }}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select office" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {regionalOffices.map((office) => (
                                                        <SelectItem key={office.id} value={office.id}>
                                                            {office.name} ({office.region.name})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <FormField
                                control={form.control}
                                name="joiningDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Joining Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="lifecycleStatus"
                                render={({ field }) => {
                                    const isTerminated = guard.lifecycleStatus === "TERMINATED"
                                    return (
                                        <FormItem>
                                            <FormLabel>Status</FormLabel>
                                            <Select
                                                value={field.value || "PENDING"}
                                                onValueChange={field.onChange}
                                                disabled={isTerminated}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="PENDING">Pending</SelectItem>
                                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                                    {isTerminated && (
                                                        <SelectItem value="TERMINATED">Terminated</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            {isTerminated ? (
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Terminated guards cannot be edited from this form.
                                                </p>
                                            ) : null}
                                            <FormMessage />
                                        </FormItem>
                                    )
                                }}
                            />

                            <FormField
                                control={form.control}
                                name="paymentMode"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Payment Mode</FormLabel>
                                        <Select value={field.value || "BANK"} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="BANK">Bank</SelectItem>
                                                <SelectItem value="CASH">Cash</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="guardCategory"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Guard Category</FormLabel>
                                        <Select value={field.value || "REGULAR"} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="MUJAHID">Mujahid</SelectItem>
                                                <SelectItem value="REGULAR">Regular</SelectItem>
                                                <SelectItem value="EX_SERVICE">Ex Service</SelectItem>
                                                <SelectItem value="OTHER">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="supervisorId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Supervisor</FormLabel>
                                        <Select
                                            value={field.value || ""}
                                            onValueChange={field.onChange}
                                            disabled={!selectedRegionalOfficeId || supervisorsLoading}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={
                                                        supervisorsLoading
                                                            ? "Loading supervisors..."
                                                            : !selectedRegionalOfficeId
                                                                ? "— Select office first —"
                                                                : "— No Supervisor —"
                                                    } />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {supervisors.map((s) => (
                                                    <SelectItem key={s.id} value={s.id}>
                                                        {s.name} ({s.email})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Previous Employment */}
                <Card>
                    <CardHeader>
                        <CardTitle>Previous Employment Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PreviousEmploymentEditor
                            defaultJson={guard.previousEmploymentsJson ?? null}
                            defaultEmploymentType={guard.exServiceType ?? (guard.isExService ? "" : "CIVILIAN")}
                            onDirtyChange={setSubEditorsDirty}
                        />
                    </CardContent>
                </Card>

                {/* Banking */}
                <Card>
                    <CardHeader>
                        <CardTitle>Banking Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <GuardAccountsEditor control={form.control} />
                    </CardContent>
                </Card>

                {/* Nearest Relatives */}
                <Card>
                    <CardHeader>
                        <CardTitle>Nearest Relative Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <NearestRelativesEditor
                            defaultJson={guard.nearestRelativesJson}
                            onDirtyChange={setSubEditorsDirty}
                        />
                    </CardContent>
                </Card>

                {/* Family Members */}
                <Card>
                    <CardHeader>
                        <CardTitle>Family Members</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FamilyMembersEditor
                            defaultJson={guard.familyMembersJson ?? null}
                            onDirtyChange={setSubEditorsDirty}
                        />
                    </CardContent>
                </Card>

                {/* Form Actions */}
                <div className="flex items-center gap-3 pt-4 border-t">
                    {isDirty ? (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type="button" variant="outline">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Cancel
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Unsaved changes will be lost.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Keep editing</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => router.push(cancelHref)}>
                                        Discard
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push(cancelHref)}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Cancel
                        </Button>
                    )}

                    <PermissionGate module="GUARDS" action="UPDATE" mode="disable">
                        <Button type="submit" disabled={loading || !isDirty}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </PermissionGate>
                </div>
            </form>
        </Form>
    )
}
