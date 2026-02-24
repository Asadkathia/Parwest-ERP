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
    const [isBranchless, setIsBranchless] = useState(true)
    const [introducerAddress, setIntroducerAddress] = useState("")
    const [defaultBranchName, setDefaultBranchName] = useState("")

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
            isBranchless,
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
                                Client's Name * <span className="text-red-500">*</span>
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
                                <option value="">Client Type</option>
                                <option value="BANK">bank</option>
                                <option value="MANUFACTURER">manufacturer</option>
                                <option value="OTHER">other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Client's Email *
                            </label>
                            <input
                                type="email"
                                name="email"
                                required
                                className="ui-input"
                                placeholder="Client's Email"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Enrollment Date* (Please Enter Correct Enrollment Date For Accurate Reporting)
                            </label>
                            <input
                                type="date"
                                name="enrollmentDate"
                                required
                                className="ui-input"
                            />
                        </div>

                        <div className="md:col-span-2 lg:col-span-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="is_client_branch_less_checkbox"
                                    value="true"
                                    checked={isBranchless}
                                    onChange={(e) => setIsBranchless(e.target.checked)}
                                    className="h-4 w-4 accent-[var(--brand)]"
                                />
                                <span className="text-sm text-[var(--text)]">Branchless</span>
                            </label>
                            <input type="hidden" name="isBranchless" value={isBranchless ? "true" : "false"} />
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contact Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Person *</label>
                            <input
                                type="text"
                                name="contactPerson"
                                required
                                className="ui-input"
                                placeholder="Contact person"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Number *</label>
                            <input
                                type="text"
                                name="contactNumber"
                                required
                                className="ui-input"
                                placeholder="Contact number"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Client Location</label>
                            <select
                                name="clientLocation"
                                className="ui-select"
                                defaultValue="Lahore"
                            >
                                <option value="All Cities">All Cities</option>
                                <option value="Lahore">Lahore</option>
                                <option value="Gujranwala">Gujranwala</option>
                                <option value="Sahiwal">Sahiwal</option>
                                <option value="Islamabad">Islamabad</option>
                                <option value="Karachi">Karachi</option>
                                <option value="Multan">Multan</option>
                                <option value="Faisalabad">Faisalabad</option>
                                <option value="Khanpur">Khanpur</option>
                                <option value="Chichawatni">Chichawatni</option>
                                <option value="Bahawalpur">Bahawalpur</option>
                                <option value="Mian Channu">Mian Channu</option>
                                <option value="Khanewal">Khanewal</option>
                                <option value="Ahmedpur East">Ahmedpur East</option>
                                <option value="Ahmed Nager Chatha">Ahmed Nager Chatha</option>
                                <option value="Ali Pur">Ali Pur</option>
                                <option value="Arifwala">Arifwala</option>
                                <option value="Attock">Attock</option>
                                <option value="Basti Malook">Basti Malook</option>
                                <option value="Bhagalchur">Bhagalchur</option>
                                <option value="Bhalwal">Bhalwal</option>
                                <option value="Bahawalnagar">Bahawalnagar</option>
                                <option value="Bhaipheru">Bhaipheru</option>
                                <option value="Bhakkar">Bhakkar</option>
                                <option value="Burewala">Burewala</option>
                                <option value="Chailianwala">Chailianwala</option>
                                <option value="Chakwal">Chakwal</option>
                                <option value="Chiniot">Chiniot</option>
                                <option value="Chowk Azam">Chowk Azam</option>
                                <option value="Chowk Sarwar Shaheed">Chowk Sarwar Shaheed</option>
                                <option value="Daska">Daska</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Client's Postal Code</label>
                            <input
                                type="text"
                                name="clientPostalCode"
                                className="ui-input"
                                placeholder="Postal code"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Head Office Address *
                            </label>
                            <textarea
                                name="headOfficeAddress"
                                required
                                rows={2}
                                className="ui-textarea"
                                placeholder="Head Office Address"
                            />
                        </div>
                    </div>
                </div>

                {/* Introducer/Referral */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Introducer/Referral</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
                            <input type="text" name="introducerName" className="ui-input" placeholder="Name" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Number</label>
                            <input type="text" name="introducerContactNumber" className="ui-input" placeholder="Contact number" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Address</label>
                            <input
                                type="text"
                                name="introducer_address"
                                className="ui-input"
                                placeholder="Address"
                                value={introducerAddress}
                                onChange={(event) => setIntroducerAddress(event.target.value)}
                            />
                            <input type="hidden" name="introducerAddress" value={introducerAddress} />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Cnic Number</label>
                            <input type="text" name="introducerCnicNumber" className="ui-input" placeholder="CNIC number" />
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
                                <option value="">Select Operational Territory</option>
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
                {isBranchless ? (
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
                                <option value="">-Select Regional Office--</option>
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
                ) : null}

                {!isBranchless ? (
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Default Branch</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Default Branch Name</label>
                            <input
                                type="text"
                                name="default_branch_name"
                                className="ui-input"
                                placeholder="Default Branch Name"
                                value={defaultBranchName}
                                onChange={(event) => setDefaultBranchName(event.target.value)}
                            />
                            <input type="hidden" name="defaultBranchName" value={defaultBranchName} />
                        </div>
                    </div>
                </div>
                ) : (
                  <input type="hidden" name="default_branch_name" value="" />
                )}

                {/* Branchless Client Contract */}
                {isBranchless ? (
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
