"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"

type Region = {
    id: string
    name: string
}

type Props = {
    regions: Region[]
}

export default function ClientEnrollmentForm({ regions }: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [enrollmentMode, setEnrollmentMode] = useState<"BRANCHLESS" | "GROUP_WITH_BRANCHES">("BRANCHLESS")
    const [groupBranches, setGroupBranches] = useState<Array<{ name: string; city: string; type: "ISLAMIC" | "CONVENTIONAL" }>>([])

    const applyOcrFields = (fields: Record<string, string>) => {
        const form = formRef.current
        if (!form) return

        Object.entries(fields).forEach(([name, value]) => {
            const input = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
            if (input) input.value = value
        })
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const data = {
            ...Object.fromEntries(formData.entries()),
            enrollmentMode,
            branches: groupBranches,
        }

        try {
            const response = await fetch("/api/clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || "Failed to create client")
            }

            router.push("/clients")
            router.refresh()
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="ui-card p-6">
            {error && (
                <div className="mb-6 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="mb-6">
                <OcrUploadPanel target="client" onApply={applyOcrFields} />
            </div>

            <div className="space-y-8">
                {/* Basic Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Client Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                required
                                className="ui-input"
                                placeholder="Enter client name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Client Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="type"
                                required
                                className="ui-select"
                            >
                                <option value="">Select type</option>
                                <option value="BANK">Bank</option>
                                <option value="MANUFACTURER">Manufacturer</option>
                                <option value="RETAIL">Retail</option>
                                <option value="CORPORATE">Corporate</option>
                                <option value="GOVERNMENT">Government</option>
                                <option value="RESIDENTIAL">Residential</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                className="ui-input"
                                placeholder="client@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Enrollment Date
                            </label>
                            <input
                                type="date"
                                name="enrollmentDate"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Region
                            </label>
                            <select
                                name="regionId"
                                className="ui-select"
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
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                City
                            </label>
                            <input
                                type="text"
                                name="city"
                                className="ui-input"
                                placeholder="Enter city"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Status
                            </label>
                            <select
                                name="status"
                                defaultValue="ACTIVE"
                                className="ui-select"
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="isBranchless"
                                    value="true"
                                    checked={enrollmentMode === "BRANCHLESS"}
                                    onChange={(e) => setEnrollmentMode(e.target.checked ? "BRANCHLESS" : "GROUP_WITH_BRANCHES")}
                                    className="h-4 w-4 accent-[var(--brand)]"
                                />
                                <span className="text-sm text-[var(--text)]">Branchless Client</span>
                            </label>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Enrollment Mode</label>
                            <select
                                className="ui-select"
                                value={enrollmentMode}
                                onChange={(e) => setEnrollmentMode(e.target.value as "BRANCHLESS" | "GROUP_WITH_BRANCHES")}
                            >
                                <option value="BRANCHLESS">Branchless</option>
                                <option value="GROUP_WITH_BRANCHES">Group Client + Add Branches</option>
                            </select>
                            <input type="hidden" name="enrollmentMode" value={enrollmentMode} />
                        </div>
                    </div>
                </div>

                {/* Address Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Address Information</h2>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Head Office Address
                            </label>
                            <textarea
                                name="headOfficeAddress"
                                rows={3}
                                className="ui-textarea"
                                placeholder="Enter head office address"
                            />
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contact Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Person</label>
                            <input
                                type="text"
                                name="contactPerson"
                                className="ui-input"
                                placeholder="Contact person"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Number</label>
                            <input
                                type="text"
                                name="contactNumber"
                                className="ui-input"
                                placeholder="Contact number"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Client Location</label>
                            <input
                                type="text"
                                name="clientLocation"
                                className="ui-input"
                                placeholder="Client location"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Client Postal Code</label>
                            <input
                                type="text"
                                name="clientPostalCode"
                                className="ui-input"
                                placeholder="Postal code"
                            />
                        </div>
                    </div>
                </div>

                {/* Introducer/Referral */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Introducer / Referral</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Introducer Name</label>
                            <input type="text" name="introducerName" className="ui-input" placeholder="Name" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Introducer Contact Number</label>
                            <input type="text" name="introducerContactNumber" className="ui-input" placeholder="Contact number" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Introducer Address</label>
                            <input type="text" name="introducerAddress" className="ui-input" placeholder="Address" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Introducer CNIC Number</label>
                            <input type="text" name="introducerCnicNumber" className="ui-input" placeholder="CNIC number" />
                        </div>
                    </div>
                </div>

                {/* Tax & Legal Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Tax & Legal Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                NTN (National Tax Number)
                            </label>
                            <input
                                type="text"
                                name="ntn"
                                className="ui-input"
                                placeholder="Enter NTN"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                STRN (Sales Tax Registration)
                            </label>
                            <input
                                type="text"
                                name="strn"
                                className="ui-input"
                                placeholder="Enter STRN"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Contract Document URL
                            </label>
                            <input
                                type="url"
                                name="contractUrl"
                                className="ui-input"
                                placeholder="https://..."
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Logo URL
                            </label>
                            <input
                                type="url"
                                name="logoUrl"
                                className="ui-input"
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                </div>

                {/* Assign Weapon */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Assign Weapon</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">License Number</label>
                            <input type="text" name="licenseNumber" className="ui-input" placeholder="License number" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Serial Number</label>
                            <input type="text" name="serialNumber" className="ui-input" placeholder="Serial number" />
                        </div>
                    </div>
                </div>

                {/* Operational Territory */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Operational Territory</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Operational Provinces</label>
                            <select name="operationalProvinces" className="ui-select">
                                <option value="">Select operational territory</option>
                                <option value="Punjab">Punjab</option>
                                <option value="Sindh">Sindh</option>
                                <option value="KPK">KPK</option>
                                <option value="Balochistan">Balochistan</option>
                                <option value="All Pakistan">All Pakistan</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Branchless Location Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Branchless Location Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Location Name</label>
                            <input type="text" name="locationName" className="ui-input" placeholder="Location name" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Regional Office</label>
                            <select name="locationRegionalOffice" className="ui-select">
                                <option value="">Select regional office</option>
                                {regions.map((region) => (
                                    <option key={region.id} value={region.id}>{region.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Latitude</label>
                            <input type="text" name="latitude" className="ui-input" placeholder="(-90 to 90)" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Longitude</label>
                            <input type="text" name="longitude" className="ui-input" placeholder="(-180 to 180)" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Day Guard Capacity</label>
                            <input type="number" name="dayGuardCapacity" className="ui-input" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Night Guard Capacity</label>
                            <input type="number" name="nightGuardCapacity" className="ui-input" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Day Supervisor Capacity</label>
                            <input type="number" name="daySupervisorCapacity" className="ui-input" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Night Supervisor Capacity</label>
                            <input type="number" name="nightSupervisorCapacity" className="ui-input" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">CPO Capacity</label>
                            <input type="number" name="cpoCapacity" className="ui-input" placeholder="0" />
                        </div>
                    </div>
                </div>

                {/* Branchless Client Contract */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Branchless Client Contract</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Start</label>
                            <input type="date" name="contractStart" className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract End</label>
                            <input type="date" name="contractEnd" className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Rate Start</label>
                            <input type="date" name="contractRateStart" className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Rate End</label>
                            <input type="date" name="contractRateEnd" className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">City</label>
                            <input type="text" name="contractCity" className="ui-input" placeholder="City" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Type</label>
                            <select name="contractGuardType" className="ui-select">
                                <option value="">Select guard type</option>
                                <option value="Guard">Guard</option>
                                <option value="Supervisor">Supervisor</option>
                                <option value="CPO">CPO</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Ex Service</label>
                            <select name="contractGuardExService" className="ui-select">
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Price</label>
                            <input type="number" name="contractPrice" className="ui-input" placeholder="Price" />
                        </div>
                    </div>
                </div>

                {enrollmentMode === "GROUP_WITH_BRANCHES" ? (
                    <div>
                        <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Group Branch Setup</h2>
                        <div className="space-y-3">
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    className="ui-btn ui-btn-secondary px-3 py-1.5 text-sm"
                                    onClick={() => setGroupBranches((prev) => [...prev, { name: "", city: "", type: "CONVENTIONAL" }])}
                                >
                                    Add Branch
                                </button>
                            </div>
                            {groupBranches.length === 0 ? (
                                <p className="text-sm text-[var(--text-muted)]">No branches added yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {groupBranches.map((branch, index) => (
                                        <div key={`branch-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                                            <input
                                                className="ui-input"
                                                placeholder="Branch name"
                                                value={branch.name}
                                                onChange={(e) =>
                                                    setGroupBranches((prev) =>
                                                        prev.map((item, idx) => (idx === index ? { ...item, name: e.target.value } : item))
                                                    )
                                                }
                                            />
                                            <input
                                                className="ui-input"
                                                placeholder="City"
                                                value={branch.city}
                                                onChange={(e) =>
                                                    setGroupBranches((prev) =>
                                                        prev.map((item, idx) => (idx === index ? { ...item, city: e.target.value } : item))
                                                    )
                                                }
                                            />
                                            <select
                                                className="ui-select"
                                                value={branch.type}
                                                onChange={(e) =>
                                                    setGroupBranches((prev) =>
                                                        prev.map((item, idx) =>
                                                            idx === index ? { ...item, type: e.target.value as "ISLAMIC" | "CONVENTIONAL" } : item
                                                        )
                                                    )
                                                }
                                            >
                                                <option value="CONVENTIONAL">Conventional</option>
                                                <option value="ISLAMIC">Islamic</option>
                                            </select>
                                            <button
                                                type="button"
                                                className="text-left text-sm text-red-600 hover:underline"
                                                onClick={() => setGroupBranches((prev) => prev.filter((_, idx) => idx !== index))}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t">
                <Link
                    href="/clients"
                    className="ui-btn ui-btn-secondary inline-flex items-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="ui-btn ui-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="h-4 w-4" />
                    {loading ? "Saving..." : "Save Client"}
                </button>
            </div>
        </form>
    )
}
