"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

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

export default function GuardEnrollmentForm({ regions, regionalOffices }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const data = Object.fromEntries(formData.entries())

        try {
            const response = await fetch("/api/guards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || "Failed to create guard")
            }

            router.push("/guards")
            router.refresh()
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="ui-card p-6">
            {error && (
                <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                </div>
            )}

            <div className="space-y-8">
                {/* Basic Information */}
                <div>
                    <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border)]">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                required
                                className="ui-input"
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
                                className="ui-input"
                                placeholder="12345-1234567-1"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                className="ui-input"
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
                                className="ui-input"
                                placeholder="guard@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Date of Birth
                            </label>
                            <input
                                type="date"
                                name="dateOfBirth"
                                className="ui-input"
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
                                className="ui-input"
                                placeholder="Age"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Father's Name
                            </label>
                            <input
                                type="text"
                                name="fatherName"
                                className="ui-input"
                                placeholder="Father's name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Mother's Name
                            </label>
                            <input
                                type="text"
                                name="motherName"
                                className="ui-input"
                                placeholder="Mother's name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Religion
                            </label>
                            <select
                                name="religion"
                                className="ui-input"
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
                                className="ui-input"
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
                                className="ui-input"
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
                                className="ui-input"
                                placeholder="Pakistani"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Next of Kin
                            </label>
                            <input
                                type="text"
                                name="nextOfKin"
                                className="ui-input"
                                placeholder="Next of kin"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                CNIC Issue Date
                            </label>
                            <input
                                type="date"
                                name="cnicIssueDate"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                CNIC Expiry Date
                            </label>
                            <input
                                type="date"
                                name="cnicExpiryDate"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Guarding Duration
                            </label>
                            <input
                                type="text"
                                name="guardingDuration"
                                className="ui-input"
                                placeholder="e.g., 5 years"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Disability
                            </label>
                            <input
                                type="text"
                                name="disability"
                                className="ui-input"
                                placeholder="None"
                            />
                        </div>
                    </div>
                </div>

                {/* Address Information */}
                <div>
                    <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border)]">Address Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Permanent Address
                            </label>
                            <textarea
                                name="addressPermanent"
                                rows={3}
                                className="ui-input"
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
                                className="ui-input"
                                placeholder="Enter current address"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Emergency Contact
                            </label>
                            <input
                                type="text"
                                name="emergencyContact"
                                className="ui-input"
                                placeholder="Emergency contact number"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                District
                            </label>
                            <input
                                type="text"
                                name="district"
                                className="ui-input"
                                placeholder="District"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                City
                            </label>
                            <input
                                type="text"
                                name="city"
                                className="ui-input"
                                placeholder="City"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                State
                            </label>
                            <input
                                type="text"
                                name="state"
                                className="ui-input"
                                placeholder="State"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Postal Code
                            </label>
                            <input
                                type="text"
                                name="postalCode"
                                className="ui-input"
                                placeholder="Postal code"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Country
                            </label>
                            <input
                                type="text"
                                name="country"
                                className="ui-input"
                                placeholder="Country"
                            />
                        </div>
                    </div>
                </div>

                {/* Employment Information */}
                <div>
                    <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border)]">Employment Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Region
                            </label>
                            <select
                                name="regionId"
                                className="ui-input"
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
                                className="ui-input"
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
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                name="status"
                                defaultValue="PENDING"
                                className="ui-input"
                            >
                                <option value="PENDING">Pending</option>
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Ex-Service Information */}
                <div>
                    <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border)]">Ex-Service Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="isExService"
                                    value="true"
                                    className="h-4 w-4 accent-[var(--brand)]"
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
                                className="ui-input"
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
                                className="ui-input"
                                placeholder="e.g., Punjab Regiment"
                            />
                        </div>
                    </div>
                </div>

                {/* Banking Information */}
                <div>
                    <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border)]">Banking Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bank Name
                            </label>
                            <input
                                type="text"
                                name="bankName"
                                className="ui-input"
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
                                className="ui-input"
                                placeholder="Account number"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Account Type
                            </label>
                            <select
                                name="bankAccountType"
                                className="ui-input"
                            >
                                <option value="">Select type</option>
                                <option value="Savings">Savings</option>
                                <option value="Current">Current</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Verification Details */}
                <div>
                    <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border)]">Verification Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            "NADRA Verification",
                            "Health Certificate Verification",
                            "Police Verification",
                            "Eyesight Certificate",
                            "Character Verification",
                            "Mental Health Check",
                            "Company Card & CNIC",
                        ].map((item) => (
                            <label key={item} className="inline-flex items-center gap-2">
                                <input type="checkbox" name={`verification_${item.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`} value="true" />
                                <span className="text-sm text-gray-700">{item}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Introducer and Relative Details */}
                <div>
                    <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border)]">Introducer / Relative Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Introducer Name</label>
                            <input type="text" name="introducerName" className="ui-input" placeholder="Introducer name" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Introducer Address</label>
                            <input type="text" name="introducerAddress" className="ui-input" placeholder="Introducer address" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Introducer Relation</label>
                            <input type="text" name="introducerRelation" className="ui-input" placeholder="Relation" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Relative Name</label>
                            <input type="text" name="relativeName" className="ui-input" placeholder="Relative name" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Relative CNIC #</label>
                            <input type="text" name="relativeCnic" className="ui-input" placeholder="12345-1234567-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Relative Address</label>
                            <input type="text" name="relativeAddress" className="ui-input" placeholder="Relative address" />
                        </div>
                    </div>
                </div>

                {/* Manager Information */}
                <div>
                    <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border)]">Office / Regional Manager Info</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Manager Name</label>
                            <input type="text" name="managerName" className="ui-input" placeholder="Manager name" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Manager Contact #</label>
                            <input type="text" name="managerContact" className="ui-input" placeholder="03XX-XXXXXXX" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Manager Email</label>
                            <input type="email" name="managerEmail" className="ui-input" placeholder="manager@example.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Supervisor Name</label>
                            <input type="text" name="supervisorName" className="ui-input" placeholder="Supervisor name" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Supervisor Contact #</label>
                            <input type="text" name="supervisorContact" className="ui-input" placeholder="03XX-XXXXXXX" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Supervisor Email</label>
                            <input type="email" name="supervisorEmail" className="ui-input" placeholder="supervisor@example.com" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t">
                <Link
                    href="/guards"
                    className="ui-btn ui-btn-secondary flex items-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="ui-btn ui-btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="h-4 w-4" />
                    {loading ? "Saving..." : "Save Guard"}
                </button>
            </div>
        </form>
    )
}
