"use client"

import { useEffect, useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Guard = {
    id: string
    parwestId: string
    name: string
    cnic: string
}

type Residence = {
    id: string
    address: string
    supervisor: string | null
    occupied: number | null
    capacity: number | null
}

export default function AssignResidenceForm() {
    const [guards, setGuards] = useState<Guard[]>([])
    const [residences, setResidences] = useState<Residence[]>([])

    const [supervisor, setSupervisor] = useState("")
    const [residenceId, setResidenceId] = useState("")
    const [guardId, setGuardId] = useState("")
    const [assignDate, setAssignDate] = useState("")
    const [revokeDate, setRevokeDate] = useState("")
    const [comment, setComment] = useState("")

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    useEffect(() => {
        const loadData = async () => {
            try {
                const [guardsRes, residencesRes] = await Promise.all([
                    fetch("/api/guards?status=ACTIVE"),
                    fetch("/api/residences?status=ACTIVE"),
                ])

                if (guardsRes.ok) {
                    const guardsData = await guardsRes.json()
                    setGuards(guardsData)
                }

                if (residencesRes.ok) {
                    const residencesData = await residencesRes.json()
                    setResidences(residencesData)
                }
            } catch {
                setGuards([])
                setResidences([])
            }
        }

        loadData()
    }, [])

    const selectedGuard = useMemo(() => guards.find((guard) => guard.id === guardId), [guards, guardId])
    const selectedResidence = useMemo(() => residences.find((item) => item.id === residenceId), [residences, residenceId])

    useEffect(() => {
        if (selectedResidence?.supervisor) {
            setSupervisor(selectedResidence.supervisor)
        }
    }, [selectedResidence])

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess("")

        if (!guardId || !residenceId) {
            setError("Guard and residence are required")
            return
        }

        try {
            setLoading(true)

            const notes = [supervisor ? `Supervisor: ${supervisor}` : ""].filter(Boolean).join(" | ")
            const legacyNotes = [
                supervisor ? `Supervisor: ${supervisor}` : "",
                comment ? `Comment: ${comment}` : "",
                revokeDate ? `Revoke Date: ${revokeDate}` : "",
            ]
                .filter(Boolean)
                .join(" | ")

            const response = await fetch("/api/residence-assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guardId,
                    residenceId,
                    assignedAt: assignDate || undefined,
                    notes: legacyNotes || notes || undefined,
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to assign residence")
            }

            setSuccess("Residence assigned successfully")
            setSupervisor("")
            setResidenceId("")
            setGuardId("")
            setAssignDate("")
            setRevokeDate("")
            setComment("")
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-5xl">
            <div>
                <h1 className="text-3xl font-bold">Assign Residence</h1>
                <p className="text-gray-600 mt-1">Assign guard to a residence master record</p>
            </div>

            {error ? <InlineAlert type="error" message={error} /> : null}
            {success ? <InlineAlert type="success" message={success} /> : null}

            <form onSubmit={onSubmit} className="bg-white rounded-lg border p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Supervisor</label>
                        <input name="supervisor_id_on_user_profile" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Supervisor name" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Residences</label>
                        <select name="residence_id" value={residenceId} onChange={(e) => setResidenceId(e.target.value)} className="w-full border rounded-md px-3 py-2" required>
                            <option value="">Nothing selected</option>
                            {residences.map((residence) => (
                                <option key={residence.id} value={residence.id}>{residence.address}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Guard</label>
                        <select name="guard_id" value={guardId} onChange={(e) => setGuardId(e.target.value)} className="w-full border rounded-md px-3 py-2" required>
                            <option value="">--Select Guard--</option>
                            {guards.map((guard) => (
                                <option key={guard.id} value={guard.id}>{guard.parwestId} - {guard.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><label className="block text-sm text-gray-600 mb-1">Guard's Name</label><input className="w-full border rounded-md px-3 py-2" value={selectedGuard?.name || ""} placeholder="Name" readOnly /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Guard's Designations</label><input className="w-full border rounded-md px-3 py-2" value="Designation" readOnly /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Guard's Type</label><input className="w-full border rounded-md px-3 py-2" value="Type" readOnly /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Assign Date</label><input type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Revoke Date</label><input type="date" value={revokeDate} onChange={(e) => setRevokeDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                    <div className="md:col-span-2"><label className="block text-sm text-gray-600 mb-1">Comment</label><input value={comment} onChange={(e) => setComment(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Comment" /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Parwest ID</label><input className="w-full border rounded-md px-3 py-2" value={selectedGuard?.parwestId || ""} placeholder="Parwest ID" readOnly /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Residence Capacity</label><input className="w-full border rounded-md px-3 py-2" value={selectedResidence ? `${selectedResidence.occupied ?? 0}/${selectedResidence.capacity ?? 0}` : ""} placeholder="Occupied/Capacity" readOnly /></div>
                </div>

                <div>
                    <ActionButton type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save Assignment"}
                    </ActionButton>
                </div>
            </form>
        </div>
    )
}
