"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"

type Client = {
    id: string
    name: string
    type: string
    email: string | null
    regionId: string | null
    city: string | null
    status: string
    isBranchless: boolean
    headOfficeAddress: string | null
    ntn: string | null
    strn: string | null
    contractUrl: string | null
    logoUrl: string | null
}

type Region = {
    id: string
    name: string
}

type Props = {
    client: Client
    regions: Region[]
}

export default function ClientEditForm({ client, regions }: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [convertToBranchfull, setConvertToBranchfull] = useState(false)
    const [firstBranchName, setFirstBranchName] = useState("")
    const [firstBranchCity, setFirstBranchCity] = useState("")

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
            isBranchless: formData.get("isBranchless") === "on",
            convertToBranchfull,
            firstBranchName,
            firstBranchCity,
        }

        try {
            const response = await fetch(`/api/clients/${client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || "Failed to update client")
            }

            router.push(`/clients/${client.id}`)
            router.refresh()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
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
                                defaultValue={client.name}
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
                                defaultValue={client.type}
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
                                defaultValue={client.email || ""}
                                className="ui-input"
                                placeholder="client@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Region
                            </label>
                            <select
                                name="regionId"
                                defaultValue={client.regionId || ""}
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
                                defaultValue={client.city || ""}
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
                                defaultValue={client.status}
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
                                    defaultChecked={client.isBranchless}
                                    className="h-4 w-4 accent-[var(--brand)]"
                                />
                                <span className="text-sm text-[var(--text)]">
                                    Branchless Client
                                </span>
                            </label>
                        </div>

                        {client.isBranchless ? (
                            <div className="md:col-span-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3 space-y-3">
                                <label className="inline-flex items-center gap-2 text-sm text-[var(--text)]">
                                    <input
                                        type="checkbox"
                                        checked={convertToBranchfull}
                                        onChange={(e) => setConvertToBranchfull(e.target.checked)}
                                        className="h-4 w-4 accent-[var(--brand)]"
                                    />
                                    Convert branchless client to branchfull
                                </label>
                                {convertToBranchfull ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <input className="ui-input" placeholder="First branch name" value={firstBranchName} onChange={(e) => setFirstBranchName(e.target.value)} />
                                        <input className="ui-input" placeholder="First branch city" value={firstBranchCity} onChange={(e) => setFirstBranchCity(e.target.value)} />
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="md:col-span-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-muted)]">
                                Branchfull client already configured. Toggle branchless only if you want to switch model.
                            </div>
                        )}
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
                                defaultValue={client.headOfficeAddress || ""}
                                className="ui-textarea"
                                placeholder="Enter head office address"
                            />
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
                                defaultValue={client.ntn || ""}
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
                                defaultValue={client.strn || ""}
                                className="ui-input"
                                placeholder="Enter STRN"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Contract Document URL
                            </label>
                            <input
                                type="url"
                                name="contractUrl"
                                defaultValue={client.contractUrl || ""}
                                className="ui-input"
                                placeholder="https://example.com/contract.pdf"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Logo URL
                            </label>
                            <input
                                type="url"
                                name="logoUrl"
                                defaultValue={client.logoUrl || ""}
                                className="ui-input"
                                placeholder="https://example.com/logo.png"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t">
                <Link
                    href={`/clients/${client.id}`}
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
                    {loading ? "Updating..." : "Update Client"}
                </button>
            </div>
        </form>
    )
}
