"use client"

import { useEffect, useMemo, useState } from "react"

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

            const response = await fetch("/api/residence-assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guardId,
                    residenceId,
                    assignedAt: assignDate || undefined,
                    notes: notes || undefined,
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

            {error && <div className="text-sm text-red-600">{error}</div>}
            {success && <div className="text-sm text-green-600">{success}</div>}

            <form onSubmit={onSubmit} className="bg-white rounded-lg border p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Supervisor</label>
                        <input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Supervisor name" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Residence</label>
                        <select value={residenceId} onChange={(e) => setResidenceId(e.target.value)} className="w-full border rounded-md px-3 py-2" required>
                            <option value="">--Select Residence--</option>
                            {residences.map((residence) => (
                                <option key={residence.id} value={residence.id}>{residence.address}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Guard</label>
                        <select value={guardId} onChange={(e) => setGuardId(e.target.value)} className="w-full border rounded-md px-3 py-2" required>
                            <option value="">--Select Guard--</option>
                            {guards.map((guard) => (
                                <option key={guard.id} value={guard.id}>{guard.parwestId} - {guard.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><label className="block text-sm text-gray-600 mb-1">Guard Name</label><input className="w-full border rounded-md px-3 py-2" value={selectedGuard?.name || ""} placeholder="Name" readOnly /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Parwest ID</label><input className="w-full border rounded-md px-3 py-2" value={selectedGuard?.parwestId || ""} placeholder="Parwest ID" readOnly /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Residence Capacity</label><input className="w-full border rounded-md px-3 py-2" value={selectedResidence ? `${selectedResidence.occupied ?? 0}/${selectedResidence.capacity ?? 0}` : ""} placeholder="Occupied/Capacity" readOnly /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Assign Date</label><input type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                </div>

                <div>
                    <button disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60">
                        {loading ? "Saving..." : "Save Assignment"}
                    </button>
                </div>
            </form>
        </div>
    )
}
