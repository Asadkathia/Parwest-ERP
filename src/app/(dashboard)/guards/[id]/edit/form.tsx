"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"
import GuardAccountsEditor from "@/components/guards/GuardAccountsEditor"
import ProfileImageCard from "@/components/guards/ProfileImageCard"
import type { NearestRelative } from "@/components/guards/tabs/types"

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
    regionId: string | null
    regionalOfficeId: string | null
    joiningDate: Date | null
    status: string
    isExService: boolean
    exServiceRank: string | null
    exServiceRegiment: string | null
    bankName: string | null
    bankAccountNumber: string | null
    bankAccountType: string | null
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

type Supervisor = {
    id: string
    name: string
    email: string
}

type Props = {
    guard: Guard
    regions: Region[]
    regionalOffices: RegionalOffice[]
    supervisors: Supervisor[]
    currentSupervisorId: string | null
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
}: {
    defaultJson: string | null
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

    const addRelative = () => setRelatives((prev) => [...prev, emptyRelative()])

    const removeRelative = (index: number) =>
        setRelatives((prev) => prev.filter((_, i) => i !== index))

    const updateRelative = (index: number, patch: Partial<NearestRelative>) =>
        setRelatives((prev) =>
            prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
        )

    return (
        <section className="space-y-3">
            <input type="hidden" name="nearestRelativesJson" value={JSON.stringify(relatives)} />

            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800">Nearest Relatives</h3>
                <button
                    type="button"
                    onClick={addRelative}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add Relative
                </button>
            </div>

            {relatives.length === 0 && (
                <p className="text-sm text-gray-500 italic">No relatives added. Click &quot;Add Relative&quot; to add one.</p>
            )}

            <div className="space-y-4">
                {relatives.map((rel, index) => (
                    <div key={index} className="rounded-md border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-700">Relative {index + 1}</p>
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
                                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-1.5 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Full name"
                                    value={rel.name || ""}
                                    onChange={(e) => updateRelative(index, { name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Father Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-1.5 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Father name"
                                    value={rel.fatherName || ""}
                                    onChange={(e) => updateRelative(index, { fatherName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Relation</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-1.5 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g. Brother, Father, Wife"
                                    value={rel.relation || ""}
                                    onChange={(e) => updateRelative(index, { relation: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Profession</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-1.5 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Profession"
                                    value={rel.profession || ""}
                                    onChange={(e) => updateRelative(index, { profession: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">CNIC</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-1.5 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="XXXXX-XXXXXXX-X"
                                    value={rel.cnic || ""}
                                    onChange={(e) => updateRelative(index, { cnic: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Contact</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-1.5 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="03XX-XXXXXXX"
                                    value={rel.contact || ""}
                                    onChange={(e) => updateRelative(index, { contact: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-1.5 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

export default function GuardEditForm({ guard, regions, regionalOffices, supervisors, currentSupervisorId }: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const formatDateForInput = (date: Date | null) => {
        if (!date) return ""
        return new Date(date).toISOString().split("T")[0]
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const data = Object.fromEntries(formData.entries())

        try {
            const response = await fetch(`/api/guards/${guard.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || "Failed to update guard")
            }

            router.push(`/guards/${guard.id}`)
            router.refresh()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setLoading(false)
        }
    }

    const applyOcrFields = (fields: Record<string, string>) => {
        const form = formRef.current
        if (!form) return
        Object.entries(fields).forEach(([name, value]) => {
            const input = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
            if (input) input.value = value
        })
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-lg border p-6">
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
                    {error}
                </div>
            )}

            <div className="mb-6">
                <OcrUploadPanel target="guard" onApply={applyOcrFields} />
            </div>
            <div className="mb-6">
                <ProfileImageCard guardId={guard.id} guardName={guard.name} initialUrl={guard.photoUrl ?? null} />
            </div>

            <div className="space-y-8">
                {/* Basic Information */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Parwest ID
                            </label>
                            <input
                                type="text"
                                value={guard.parwestId}
                                disabled
                                className="w-full px-4 py-2 border rounded-md bg-gray-100 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                required
                                defaultValue={guard.name}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter full name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                CNIC <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="cnic"
                                required
                                pattern="[0-9]{5}-[0-9]{7}-[0-9]{1}"
                                defaultValue={guard.cnic}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="12345-1234567-1"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Date of Birth
                            </label>
                            <input
                                type="date"
                                name="dateOfBirth"
                                defaultValue={formatDateForInput(guard.dateOfBirth)}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Age
                            </label>
                            <input
                                type="number"
                                name="age"
                                min="18"
                                max="65"
                                defaultValue={guard.age || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Age"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Father&apos;s Name
                            </label>
                            <input
                                type="text"
                                name="fatherName"
                                defaultValue={guard.fatherName || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Father's name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Mother&apos;s Name
                            </label>
                            <input
                                type="text"
                                name="motherName"
                                defaultValue={guard.motherName || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Mother's name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Religion
                            </label>
                            <select
                                name="religion"
                                defaultValue={guard.religion || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select religion</option>
                                <option value="Islam">Islam</option>
                                <option value="Christianity">Christianity</option>
                                <option value="Hinduism">Hinduism</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Marital Status
                            </label>
                            <select
                                name="maritalStatus"
                                defaultValue={guard.maritalStatus || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select status</option>
                                <option value="Single">Single</option>
                                <option value="Married">Married</option>
                                <option value="Divorced">Divorced</option>
                                <option value="Widowed">Widowed</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Education
                            </label>
                            <select
                                name="education"
                                defaultValue={guard.education || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select education</option>
                                <option value="Primary">Primary</option>
                                <option value="Middle">Middle</option>
                                <option value="Matric">Matric</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Graduate">Graduate</option>
                                <option value="Post-Graduate">Post-Graduate</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nationality
                            </label>
                            <input
                                type="text"
                                name="nationality"
                                defaultValue={guard.nationality || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g. Pakistani"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Next of Kin
                            </label>
                            <input
                                type="text"
                                name="nextOfKin"
                                defaultValue={guard.nextOfKin || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Next of kin name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Profile Introducer
                            </label>
                            <input
                                type="text"
                                name="profileIntroducer"
                                defaultValue={guard.profileIntroducer || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Introducer name"
                            />
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Contact Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                defaultValue={guard.phone || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="03XX-XXXXXXX"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                defaultValue={guard.email || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="guard@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Emergency Contact
                            </label>
                            <input
                                type="text"
                                name="emergencyContact"
                                defaultValue={guard.emergencyContact || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Emergency contact number"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Additional Contact Numbers
                            </label>
                            <input
                                type="text"
                                name="additionalContactNumbers"
                                defaultValue={guard.additionalContactNumbers || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g. 0311-1234567, 0321-7654321"
                            />
                        </div>
                    </div>
                </div>

                {/* Address Information */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Address Information</h2>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Permanent Address
                            </label>
                            <textarea
                                name="addressPermanent"
                                rows={3}
                                defaultValue={guard.addressPermanent || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter permanent address"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Current Address
                            </label>
                            <textarea
                                name="addressCurrent"
                                rows={3}
                                defaultValue={guard.addressCurrent || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter current address"
                            />
                        </div>
                    </div>
                </div>

                {/* Employment Information */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Employment Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Region
                            </label>
                            <select
                                name="regionId"
                                defaultValue={guard.regionId || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select region</option>
                                {regions.map((region) => (
                                    <option key={region.id} value={region.id}>
                                        {region.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Regional Office
                            </label>
                            <select
                                name="regionalOfficeId"
                                defaultValue={guard.regionalOfficeId || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select office</option>
                                {regionalOffices.map((office) => (
                                    <option key={office.id} value={office.id}>
                                        {office.name} ({office.region.name})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Joining Date
                            </label>
                            <input
                                type="date"
                                name="joiningDate"
                                defaultValue={formatDateForInput(guard.joiningDate)}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                name="status"
                                defaultValue={guard.status}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="PENDING">Pending</option>
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Payment Mode
                            </label>
                            <select name="paymentMode" defaultValue={guard.paymentMode || "BANK"} className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <option value="BANK">Bank</option>
                                <option value="CASH">Cash</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Guard Category
                            </label>
                            <select name="guardCategory" defaultValue={guard.guardCategory || "REGULAR"} className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <option value="MUJAHID">Mujahid</option>
                                <option value="REGULAR">Regular</option>
                                <option value="EX_SERVICE">Ex Service</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Supervisor
                            </label>
                            <select
                                name="supervisorId"
                                defaultValue={currentSupervisorId || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">— No Supervisor —</option>
                                {supervisors.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.email})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Ex-Service Information */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Ex-Service Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="isExService"
                                    value="true"
                                    defaultChecked={guard.isExService}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Ex-Service Personnel</span>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Rank
                            </label>
                            <input
                                type="text"
                                name="exServiceRank"
                                defaultValue={guard.exServiceRank || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., Sepoy, Naik, Havildar"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Regiment
                            </label>
                            <input
                                type="text"
                                name="exServiceRegiment"
                                defaultValue={guard.exServiceRegiment || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., Punjab Regiment"
                            />
                        </div>
                    </div>
                </div>

                {/* Banking Information */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Banking Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bank Name
                            </label>
                            <input
                                type="text"
                                name="bankName"
                                defaultValue={guard.bankName || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., HBL, MCB, UBL"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Account Number
                            </label>
                            <input
                                type="text"
                                name="bankAccountNumber"
                                defaultValue={guard.bankAccountNumber || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Account number"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Account Type
                            </label>
                            <select
                                name="bankAccountType"
                                defaultValue={guard.bankAccountType || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select type</option>
                                <option value="Savings">Savings</option>
                                <option value="Current">Current</option>
                            </select>
                        </div>
                    </div>
                    <div className="mt-4">
                        <GuardAccountsEditor />
                    </div>
                </div>

                {/* Nearest Relatives */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Nearest Relative Details</h2>
                    <NearestRelativesEditor defaultJson={guard.nearestRelativesJson} />
                </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t">
                <Link
                    href={`/guards/${guard.id}`}
                    className="flex items-center gap-2 px-6 py-2 border rounded-md hover:bg-gray-50"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="h-4 w-4" />
                    {loading ? "Updating..." : "Update Guard"}
                </button>
            </div>
        </form>
    )
}
