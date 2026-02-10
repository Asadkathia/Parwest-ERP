"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Edit, Trash2 } from "lucide-react"

type Region = {
    id: string
    name: string
}

type RegionalOffice = {
    id: string
    name: string
    seriesCode: string
    regionId: string
    region: {
        id: string
        name: string
    }
}

type Props = {
    regions: Region[]
    regionalOffices: RegionalOffice[]
}

export default function PrerequisitesManager({ regions: initialRegions, regionalOffices: initialOffices }: Props) {
    const router = useRouter()
    const [regions, setRegions] = useState(initialRegions)
    const [regionalOffices, setRegionalOffices] = useState(initialOffices)
    const [showRegionForm, setShowRegionForm] = useState(false)
    const [showOfficeForm, setShowOfficeForm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleAddRegion = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const data = {
            name: formData.get("name"),
        }

        try {
            const response = await fetch("/api/regions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                throw new Error("Failed to create region")
            }

            router.refresh()
            setShowRegionForm(false)
                ; (e.target as HTMLFormElement).reset()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleAddOffice = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const data = {
            name: formData.get("name"),
            seriesCode: formData.get("seriesCode"),
            regionId: formData.get("regionId"),
        }

        try {
            const response = await fetch("/api/regional-offices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                throw new Error("Failed to create regional office")
            }

            router.refresh()
            setShowOfficeForm(false)
                ; (e.target as HTMLFormElement).reset()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8">
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
                    {error}
                </div>
            )}

            {/* Regions Section */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Regions</h2>
                    <button
                        onClick={() => setShowRegionForm(!showRegionForm)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        Add Region
                    </button>
                </div>

                {showRegionForm && (
                    <form onSubmit={handleAddRegion} className="mb-6 p-4 bg-gray-50 rounded-md">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Region Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    placeholder="e.g., Punjab, Sindh, KPK"
                                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? "Saving..." : "Save Region"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowRegionForm(false)}
                                className="px-4 py-2 border rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                <div className="space-y-2">
                    {regions.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No regions added yet</p>
                    ) : (
                        regions.map((region) => (
                            <div
                                key={region.id}
                                className="flex items-center justify-between p-4 border rounded-md hover:bg-gray-50"
                            >
                                <div>
                                    <p className="font-medium">{region.name}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Regional Offices Section */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Regional Offices</h2>
                    <button
                        onClick={() => setShowOfficeForm(!showOfficeForm)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                        disabled={regions.length === 0}
                    >
                        <Plus className="h-4 w-4" />
                        Add Regional Office
                    </button>
                </div>

                {regions.length === 0 && (
                    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
                        Please add at least one region before creating regional offices.
                    </div>
                )}

                {showOfficeForm && (
                    <form onSubmit={handleAddOffice} className="mb-6 p-4 bg-gray-50 rounded-md">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Office Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    placeholder="e.g., Lahore Office"
                                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Series Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="seriesCode"
                                    required
                                    placeholder="e.g., LHR, KHI"
                                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Region <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="regionId"
                                    required
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
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? "Saving..." : "Save Office"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowOfficeForm(false)}
                                className="px-4 py-2 border rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                <div className="space-y-2">
                    {regionalOffices.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No regional offices added yet</p>
                    ) : (
                        regionalOffices.map((office) => (
                            <div
                                key={office.id}
                                className="flex items-center justify-between p-4 border rounded-md hover:bg-gray-50"
                            >
                                <div>
                                    <p className="font-medium">{office.name}</p>
                                    <p className="text-sm text-gray-600">
                                        Series: {office.seriesCode} | Region: {office.region.name}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
