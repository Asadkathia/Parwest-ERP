"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import InlineAlert from "@/components/ui/inline-alert"

type GuardOption = {
    id: string
    parwestId: string
    name: string
    cnic: string
}

export default function NewTrainingForm() {
    const router = useRouter()
    const [guards, setGuards] = useState<GuardOption[]>([])
    const [regionalOffice, setRegionalOffice] = useState("")
    const [client, setClient] = useState("")
    const [branch, setBranch] = useState("")
    const [branchSupervisor, setBranchSupervisor] = useState("")
    const [branchManager, setBranchManager] = useState("")
    const [guardId, setGuardId] = useState("")
    const [date, setDate] = useState("")
    const [conductedBy, setConductedBy] = useState("")
    const [remarks, setRemarks] = useState("")
    const [armorer, setArmorer] = useState(false)
    const [supervisorWithUniform, setSupervisorWithUniform] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        const loadGuards = async () => {
            try {
                const response = await fetch("/api/guards?status=ACTIVE")
                if (!response.ok) return
                const data = await response.json()
                setGuards(data)
            } catch {
                setGuards([])
            }
        }

        loadGuards()
    }, [])

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!guardId || !date) {
            setError("Guard and date are required")
            return
        }

        try {
            setLoading(true)
            const response = await fetch("/api/trainings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guardId,
                    trainingType: "ON_JOB",
                    completedAt: date,
                    instructor: conductedBy,
                    notes: [
                        remarks,
                        `Regional Office: ${regionalOffice || "-"}`,
                        `Client: ${client || "-"}`,
                        `Branch: ${branch || "-"}`,
                        `Branch Supervisor: ${branchSupervisor || "-"}`,
                        `Branch Manager: ${branchManager || "-"}`,
                        `Armorer: ${armorer ? "Yes" : "No"}`,
                        `Supervisor With Uniform: ${supervisorWithUniform ? "Yes" : "No"}`,
                    ]
                        .filter(Boolean)
                        .join(" | "),
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to create training")
            }

            router.push("/guards/trainings")
            router.refresh()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <SectionTitle title="Add OnJob Training" subtitle="Create a new OJT training record" />
                <Link href="/guards/trainings" className="ui-btn ui-btn-secondary">Return to List</Link>
            </div>

            {error && <InlineAlert type="error" message={error} />}

            <form onSubmit={onSubmit} className="space-y-5">
                <FilterBar>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Regional Office</label>
                        <input value={regionalOffice} onChange={(e) => setRegionalOffice(e.target.value)} className="ui-input" placeholder="Regional office" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Client</label>
                        <input value={client} onChange={(e) => setClient(e.target.value)} className="ui-input" placeholder="Client" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Branch</label>
                        <input value={branch} onChange={(e) => setBranch(e.target.value)} className="ui-input" placeholder="Branch" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Branch Supervisor</label>
                        <input value={branchSupervisor} onChange={(e) => setBranchSupervisor(e.target.value)} className="ui-input" placeholder="Branch supervisor" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Branch Manager</label>
                        <input value={branchManager} onChange={(e) => setBranchManager(e.target.value)} className="ui-input" placeholder="Branch manager" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">Select Guard</label>
                        <select value={guardId} onChange={(e) => setGuardId(e.target.value)} className="ui-select" required>
                            <option value="">--Select Guard--</option>
                            {guards.map((guard) => (
                                <option key={guard.id} value={guard.id}>{guard.parwestId} - {guard.name} ({guard.cnic})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Date</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ui-input" required />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Conducted By</label>
                        <input value={conductedBy} onChange={(e) => setConductedBy(e.target.value)} className="ui-input" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Upload Files</label>
                        <input type="file" multiple className="ui-input" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-gray-600 mb-1">Remarks</label>
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="ui-textarea min-h-24" />
                </div>

                <div className="flex flex-wrap gap-6">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={armorer} onChange={(e) => setArmorer(e.target.checked)} />
                        Armorer
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={supervisorWithUniform} onChange={(e) => setSupervisorWithUniform(e.target.checked)} />
                        Supervisor With Uniform
                    </label>
                </div>

                <div className="flex justify-end gap-3">
                    <ActionButton
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setRegionalOffice("")
                            setClient("")
                            setBranch("")
                            setBranchSupervisor("")
                            setBranchManager("")
                            setGuardId("")
                            setDate("")
                            setConductedBy("")
                            setRemarks("")
                            setArmorer(false)
                            setSupervisorWithUniform(false)
                        }}
                    >
                        Reset
                    </ActionButton>
                    <ActionButton disabled={loading}>{loading ? "Submitting..." : "Submit"}</ActionButton>
                </div>
                </FilterBar>
            </form>
        </div>
    )
}
