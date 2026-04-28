"use client"

import Link from "next/link"
import { Button } from "@/components/shadcn/button"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/shadcn/card"
type GuardOption = { id: string; parwestId: string; name: string; cnic: string }
type RegionalOffice = { id: string; name: string }
type Client = { id: string; name: string }
type Branch = { id: string; name: string; supervisorName: string | null }

const EMPTY = {
    regionalOfficeId: "",
    regionalOfficeName: "",
    clientId: "",
    clientName: "",
    branchId: "",
    branchName: "",
    branchSupervisor: "",
    branchManager: "",
    guardId: "",
    date: "",
    conductedBy: "",
    remarks: "",
    armorer: false,
    supervisorWithUniform: false,
}

type NewTrainingFormProps = {
    lockedRegionId?: string | null
    lockedRegionalOfficeId?: string | null
}

export default function NewTrainingForm({ lockedRegionId = null, lockedRegionalOfficeId = null }: NewTrainingFormProps = {}) {
    const router = useRouter()
    const [form, setForm] = useState(() => ({
        ...EMPTY,
        regionalOfficeId: lockedRegionalOfficeId || "",
    }))
    const [guards, setGuards] = useState<GuardOption[]>([])
    const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [loadingClients, setLoadingClients] = useState(false)
    const [loadingBranches, setLoadingBranches] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        const guardsUrl = lockedRegionId
            ? `/api/guards?status=ACTIVE&regionId=${lockedRegionId}`
            : "/api/guards?status=ACTIVE"
        fetch(guardsUrl)
            .then(r => r.ok ? r.json() : [])
            .then(setGuards)
            .catch(() => {})
        const officesUrl = lockedRegionId
            ? `/api/regional-offices?regionId=${lockedRegionId}`
            : "/api/regional-offices"
        fetch(officesUrl)
            .then(r => r.ok ? r.json() : [])
            .then((data: RegionalOffice[]) => {
                setRegionalOffices(data)
                // Pre-fill regional office name display when locked
                if (lockedRegionalOfficeId) {
                    const office = data.find(o => o.id === lockedRegionalOfficeId)
                    if (office) {
                        setForm(f => ({ ...f, regionalOfficeId: office.id, regionalOfficeName: office.name }))
                    }
                }
            })
            .catch(() => {})
    }, [lockedRegionId, lockedRegionalOfficeId])

    useEffect(() => {
        setClients([])
        setBranches([])
        setForm(f => ({ ...f, clientId: "", clientName: "", branchId: "", branchName: "", branchSupervisor: "" }))
        if (!form.regionalOfficeId) return
        setLoadingClients(true)
        fetch(`/api/clients?regionalOfficeId=${form.regionalOfficeId}&status=ACTIVE`)
            .then(r => r.ok ? r.json() : [])
            .then(setClients)
            .catch(() => {})
            .finally(() => setLoadingClients(false))
    }, [form.regionalOfficeId])

    useEffect(() => {
        setBranches([])
        setForm(f => ({ ...f, branchId: "", branchName: "", branchSupervisor: "" }))
        if (!form.clientId) return
        setLoadingBranches(true)
        fetch(`/api/clients/${form.clientId}/branches`)
            .then(r => r.ok ? r.json() : [])
            .then(setBranches)
            .catch(() => {})
            .finally(() => setLoadingBranches(false))
    }, [form.clientId])

    const handleRegionalOfficeChange = (id: string) => {
        const office = regionalOffices.find(o => o.id === id)
        setForm(f => ({ ...f, regionalOfficeId: id, regionalOfficeName: office?.name ?? "" }))
    }

    const handleClientChange = (id: string) => {
        const client = clients.find(c => c.id === id)
        setForm(f => ({ ...f, clientId: id, clientName: client?.name ?? "" }))
    }

    const handleBranchChange = (id: string) => {
        const branch = branches.find(b => b.id === id)
        setForm(f => ({
            ...f,
            branchId: id,
            branchName: branch?.name ?? "",
            branchSupervisor: branch?.supervisorName ?? f.branchSupervisor,
        }))
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        if (!form.guardId || !form.date) {
            setError("Guard and date are required")
            return
        }
        try {
            setLoading(true)
            const notes = [
                `Regional Office: ${form.regionalOfficeName || "-"}`,
                `Client: ${form.clientName || "-"}`,
                `Branch: ${form.branchName || "-"}`,
                `Branch Supervisor: ${form.branchSupervisor || "-"}`,
                `Branch Manager: ${form.branchManager || "-"}`,
                `Armorer: ${form.armorer ? "Yes" : "No"}`,
                `Supervisor With Uniform: ${form.supervisorWithUniform ? "Yes" : "No"}`,
                `Conducted By: ${form.conductedBy || "-"}`,
                ...(form.remarks ? [`Remarks: ${form.remarks}`] : []),
            ].join(" | ")

            const res = await fetch("/api/trainings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guardId: form.guardId,
                    trainingType: "ON_JOB",
                    completedAt: form.date,
                    instructor: form.conductedBy || null,
                    notes,
                }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || "Failed to create training")
            }
            router.push("/guards/trainings")
            router.refresh()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
        } finally {
            setLoading(false)
        }
    }

    const sel = "w-full border border-input rounded-lg px-3 py-2 text-sm bg-[var(--bg-input)] text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted disabled:text-muted-foreground"
    const inp = "w-full border border-input rounded-lg px-3 py-2 text-sm bg-[var(--bg-input)] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    const lbl = "block text-sm font-medium text-foreground mb-1"

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Add OnJob Training"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Create a new OJT training record"}</p></div></div>
                <Link href="/guards/trainings" className="ui-btn ui-btn-secondary">Return to List</Link>
            </div>

            {error && <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

            <form onSubmit={onSubmit}>
                <Card>
                    <CardContent className="space-y-5 p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Regional Office */}
                        {lockedRegionalOfficeId ? (
                            <div>
                                <label className={lbl}>Regional Office</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={
                                        regionalOffices.find(o => o.id === lockedRegionalOfficeId)?.name
                                        || form.regionalOfficeName
                                        || "Locked regional office"
                                    }
                                    className={`${inp} bg-gray-50 text-gray-600`}
                                />
                                <p className="mt-1 text-xs text-gray-500">Locked to your assigned regional office.</p>
                            </div>
                        ) : (
                            <div>
                                <label className={lbl}>Regional Office</label>
                                <select className={sel} value={form.regionalOfficeId} onChange={e => handleRegionalOfficeChange(e.target.value)}>
                                    <option value="">— Select Regional Office —</option>
                                    {regionalOffices.map(o => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Client */}
                        <div>
                            <label className={lbl}>Client</label>
                            <select
                                className={sel}
                                value={form.clientId}
                                onChange={e => handleClientChange(e.target.value)}
                                disabled={!form.regionalOfficeId || loadingClients}
                            >
                                <option value="">
                                    {loadingClients ? "Loading..." : form.regionalOfficeId ? "— Select Client —" : "— Select office first —"}
                                </option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Branch */}
                        <div>
                            <label className={lbl}>Branch</label>
                            <select
                                className={sel}
                                value={form.branchId}
                                onChange={e => handleBranchChange(e.target.value)}
                                disabled={!form.clientId || loadingBranches}
                            >
                                <option value="">
                                    {loadingBranches ? "Loading..." : form.clientId ? "— Select Branch —" : "— Select client first —"}
                                </option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Branch Supervisor */}
                        <div>
                            <label className={lbl}>
                                Branch Supervisor
                                {form.branchId && form.branchSupervisor && (
                                    <span className="ml-2 text-xs text-green-600 font-normal">auto-filled</span>
                                )}
                            </label>
                            <input
                                className={inp}
                                value={form.branchSupervisor}
                                onChange={e => setForm(f => ({ ...f, branchSupervisor: e.target.value }))}
                                placeholder="Branch supervisor"
                            />
                        </div>

                        {/* Branch Manager */}
                        <div>
                            <label className={lbl}>Branch Manager</label>
                            <input
                                className={inp}
                                value={form.branchManager}
                                onChange={e => setForm(f => ({ ...f, branchManager: e.target.value }))}
                                placeholder="Branch manager"
                            />
                        </div>

                        {/* Select Guard */}
                        <div>
                            <label className={lbl}>Select Guard <span className="text-destructive">*</span></label>
                            <select className={sel} value={form.guardId} onChange={e => setForm(f => ({ ...f, guardId: e.target.value }))} required>
                                <option value="">— Select Guard —</option>
                                {guards.map(g => (
                                    <option key={g.id} value={g.id}>{g.parwestId} — {g.name} ({g.cnic})</option>
                                ))}
                            </select>
                        </div>

                        {/* Date */}
                        <div>
                            <label className={lbl}>Date <span className="text-destructive">*</span></label>
                            <input
                                type="date"
                                className={inp}
                                value={form.date}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                required
                            />
                        </div>

                        {/* Conducted By */}
                        <div>
                            <label className={lbl}>Conducted By</label>
                            <input
                                className={inp}
                                value={form.conductedBy}
                                onChange={e => setForm(f => ({ ...f, conductedBy: e.target.value }))}
                                placeholder="Instructor / trainer name"
                            />
                        </div>
                    </div>

                    {/* Armorer & Supervisor Uniform */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border rounded-lg px-4 py-3 flex items-center justify-between bg-gray-50">
                            <span className="text-sm font-medium text-gray-700">Armorer</span>
                            <div className="flex gap-5 text-sm">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="radio" checked={form.armorer} onChange={() => setForm(f => ({ ...f, armorer: true }))} /> Yes
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="radio" checked={!form.armorer} onChange={() => setForm(f => ({ ...f, armorer: false }))} /> No
                                </label>
                            </div>
                        </div>
                        <div className="border rounded-lg px-4 py-3 flex items-center justify-between bg-gray-50">
                            <span className="text-sm font-medium text-gray-700">Supervisor With Uniform</span>
                            <div className="flex gap-5 text-sm">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="radio" checked={form.supervisorWithUniform} onChange={() => setForm(f => ({ ...f, supervisorWithUniform: true }))} /> Yes
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="radio" checked={!form.supervisorWithUniform} onChange={() => setForm(f => ({ ...f, supervisorWithUniform: false }))} /> No
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className={lbl}>Remarks</label>
                        <textarea
                            className={inp}
                            rows={3}
                            value={form.remarks}
                            onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                            placeholder="Any additional remarks..."
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={() => setForm(EMPTY)}>Reset</Button>
                        <Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit"}</Button>
                    </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    )
}
