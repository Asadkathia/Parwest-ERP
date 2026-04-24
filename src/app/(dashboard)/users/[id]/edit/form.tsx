"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type RoleOption = { id: string; name: string }
type RegionOption = { id: string; name: string }
type OfficeOption = { id: string; name: string; regionId: string | null }

type UserRecord = {
    id: string
    name: string
    email: string
    status: string
    contactNumber: string | null
    roleId: string | null
    regionId: string | null
    regionalOfficeId: string | null
}

type Props = {
    user: UserRecord
    roles: RoleOption[]
    regions: RegionOption[]
    offices: OfficeOption[]
}

export default function UserEditForm({ user, roles, regions, offices }: Props) {
    const router = useRouter()
    const [name, setName] = useState(user.name ?? "")
    const [contactNumber, setContactNumber] = useState(user.contactNumber ?? "")
    const [roleId, setRoleId] = useState(user.roleId ?? "")
    const [regionId, setRegionId] = useState(user.regionId ?? "")
    const [regionalOfficeId, setRegionalOfficeId] = useState(user.regionalOfficeId ?? "")
    const [status, setStatus] = useState(user.status ?? "ACTIVE")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const availableOffices = useMemo(() => {
        if (!regionId) return offices
        return offices.filter((office) => !office.regionId || office.regionId === regionId)
    }, [offices, regionId])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        if (!name.trim()) {
            setError("Name is required.")
            setLoading(false)
            return
        }
        if (!roleId) {
            setError("Role is required.")
            setLoading(false)
            return
        }

        try {
            const response = await fetch(`/api/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    contactNumber: contactNumber.trim(),
                    roleId,
                    regionId: regionId || null,
                    regionalOfficeId: regionalOfficeId || null,
                    status,
                }),
            })

            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(data.message || "Failed to update user.")
            }

            router.push(`/users/${user.id}`)
            router.refresh()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-1 block text-sm text-[var(--text-muted)]">Name *</label>
                    <input
                        className="ui-input"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm text-[var(--text-muted)]">Email</label>
                    <input className="ui-input" type="email" value={user.email} disabled readOnly />
                </div>

                <div>
                    <label className="mb-1 block text-sm text-[var(--text-muted)]">Role *</label>
                    <select
                        className="ui-select"
                        value={roleId}
                        onChange={(e) => setRoleId(e.target.value)}
                        required
                    >
                        <option value="">-- Select Role --</option>
                        {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                                {role.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm text-[var(--text-muted)]">Contact #</label>
                    <input
                        className="ui-input"
                        type="text"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm text-[var(--text-muted)]">Region</label>
                    <select
                        className="ui-select"
                        value={regionId}
                        onChange={(e) => {
                            setRegionId(e.target.value)
                            setRegionalOfficeId("")
                        }}
                    >
                        <option value="">-- Select Region --</option>
                        {regions.map((region) => (
                            <option key={region.id} value={region.id}>
                                {region.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm text-[var(--text-muted)]">Regional Office</label>
                    <select
                        className="ui-select"
                        value={regionalOfficeId}
                        onChange={(e) => setRegionalOfficeId(e.target.value)}
                    >
                        <option value="">-- Select Regional Office --</option>
                        {availableOffices.map((office) => (
                            <option key={office.id} value={office.id}>
                                {office.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm text-[var(--text-muted)]">Status</label>
                    <select
                        className="ui-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" className="ui-btn ui-btn-primary" disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                </button>
                <Link href={`/users/${user.id}`} className="ui-btn">
                    Cancel
                </Link>
            </div>
        </form>
    )
}
