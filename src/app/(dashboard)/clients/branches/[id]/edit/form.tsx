"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { deriveBranchModel } from "@/lib/branches/model"
import PhoneInput from "@/components/ui/PhoneInput"
import { isValidPhone } from "@/lib/validation/formats"

type Branch = {
    id: string
    clientId: string
    name: string
    code: string | null
    address: string | null
    city: string | null
    province: string | null
    isHeadOffice: boolean
    contactPerson: string | null
    contactPhone: string | null
    contactEmail: string | null
    client: {
        id: string
        name: string
        type?: string | null
    }
}

type Props = {
    branch: Branch
}

export default function BranchEditForm({ branch }: Props) {
    const router = useRouter()
    const branchType = deriveBranchModel(branch.client?.type)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)

        const contactPhoneVal = String(formData.get("contactPhone") ?? "").trim()
        if (contactPhoneVal && !isValidPhone(contactPhoneVal)) {
            setError("Contact phone must be in format +92-XXX-XXXXXXX.")
            setLoading(false)
            return
        }

        const data = {
            ...Object.fromEntries(formData.entries()),
            isHeadOffice: formData.get("isHeadOffice") === "on",
        }

        try {
            const response = await fetch(`/api/branches/${branch.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || "Failed to update branch")
            }

            router.push(`/clients/branches/${branch.id}`)
            router.refresh()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="ui-card p-6">
            {error && (
                <div className="mb-6 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="space-y-8">
                {/* Basic Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Branch Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                required
                                defaultValue={branch.name}
                                placeholder="e.g., Main Branch, Gulberg Branch"
                                className="ui-input"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Branch Code
                            </label>
                            <input
                                type="text"
                                name="code"
                                defaultValue={branch.code || ""}
                                placeholder="e.g., LHR-001, ISB-002"
                                className="ui-input"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Branch Model
                            </label>
                            <select name="branchType" defaultValue={branchType} className="ui-select">
                                <option value="CONVENTIONAL">Conventional</option>
                                <option value="ISLAMIC">Islamic</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="isHeadOffice"
                                    defaultChecked={branch.isHeadOffice}
                                    className="h-4 w-4 accent-[var(--brand)]"
                                />
                                <span className="text-sm text-[var(--text)]">
                                    This is the head office
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Location Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Location Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Address
                            </label>
                            <textarea
                                name="address"
                                rows={3}
                                defaultValue={branch.address || ""}
                                placeholder="Enter complete address"
                                className="ui-textarea"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                City
                            </label>
                            <input
                                type="text"
                                name="city"
                                defaultValue={branch.city || ""}
                                placeholder="e.g., Lahore, Karachi"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Province
                            </label>
                            <select
                                name="province"
                                defaultValue={branch.province || ""}
                                className="ui-select"
                            >
                                <option value="">Select province</option>
                                <option value="Punjab">Punjab</option>
                                <option value="Sindh">Sindh</option>
                                <option value="KPK">Khyber Pakhtunkhwa</option>
                                <option value="Balochistan">Balochistan</option>
                                <option value="Islamabad">Islamabad Capital Territory</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contact Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Contact Person
                            </label>
                            <input
                                type="text"
                                name="contactPerson"
                                defaultValue={branch.contactPerson || ""}
                                placeholder="Name of contact person"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Contact Phone
                            </label>
                            <PhoneInput name="contactPhone" defaultValue={branch.contactPhone || ""} />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Contact Email
                            </label>
                            <input
                                type="email"
                                name="contactEmail"
                                defaultValue={branch.contactEmail || ""}
                                placeholder="branch@example.com"
                                className="ui-input"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t">
                <Link
                    href={`/clients/branches/${branch.id}`}
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
                    {loading ? "Saving..." : "Save Changes"}
                </button>
            </div>
        </form>
    )
}
