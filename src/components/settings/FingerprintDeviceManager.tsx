"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
type FingerprintStatus = "ONLINE" | "OFFLINE" | "WARNING"

type FingerprintDeviceRow = {
  id: string
  name: string
  officeId: string
  officeName: string
  status: FingerprintStatus
  lastSyncAt: string
  pendingEnrollments: number
}

type OfficeRow = {
  id: string
  name: string
}

type Notice = {
  type: "success" | "error"
  message: string
}

type ApiErrorPayload = {
  message?: string
  error?: { message?: string }
}

const STATUS_OPTIONS: Array<{ value: FingerprintStatus; label: string }> = [
  { value: "OFFLINE", label: "Offline" },
  { value: "ONLINE", label: "Online" },
  { value: "WARNING", label: "Warning" },
]

function getErrorMessage(payload: ApiErrorPayload | undefined, fallback: string) {
  return payload?.error?.message || payload?.message || fallback
}

export default function FingerprintDeviceManager() {
  const [devices, setDevices] = useState<FingerprintDeviceRow[]>([])
  const [offices, setOffices] = useState<OfficeRow[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [loadingOffices, setLoadingOffices] = useState(false)
  const [saving, setSaving] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const [filterOfficeId, setFilterOfficeId] = useState("all")
  const [filterStatus, setFilterStatus] = useState<"all" | FingerprintStatus>("all")
  const [newDeviceName, setNewDeviceName] = useState("")
  const [newDeviceOfficeId, setNewDeviceOfficeId] = useState("")
  const [newDeviceStatus, setNewDeviceStatus] = useState<FingerprintStatus>("OFFLINE")

  const loadOffices = useCallback(async () => {
    setLoadingOffices(true)
    try {
      const response = await fetch("/api/regional-offices", { cache: "no-store" })
      const payload = (await response.json().catch(() => [])) as OfficeRow[]
      if (!response.ok) {
        throw new Error("Failed to load offices.")
      }
      const rows = Array.isArray(payload) ? payload.map((row) => ({ id: row.id, name: row.name })) : []
      setOffices(rows)
      if (!newDeviceOfficeId && rows[0]?.id) setNewDeviceOfficeId(rows[0].id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load offices."
      setNotice({ type: "error", message })
      setOffices([])
    } finally {
      setLoadingOffices(false)
    }
  }, [newDeviceOfficeId])

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true)
    try {
      const params = new URLSearchParams()
      if (filterOfficeId !== "all") params.set("officeId", filterOfficeId)
      if (filterStatus !== "all") params.set("status", filterStatus)
      const query = params.toString()
      const response = await fetch(`/api/fingerprint-devices${query ? `?${query}` : ""}`, { cache: "no-store" })
      const payload = (await response.json().catch(() => [])) as FingerprintDeviceRow[] | ApiErrorPayload
      if (!response.ok) {
        throw new Error(getErrorMessage(payload as ApiErrorPayload, "Failed to load fingerprint devices."))
      }
      setDevices(Array.isArray(payload) ? payload : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load fingerprint devices."
      setDevices([])
      setNotice({ type: "error", message })
    } finally {
      setLoadingDevices(false)
    }
  }, [filterOfficeId, filterStatus])

  useEffect(() => {
    void loadOffices()
  }, [loadOffices])

  useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  const bindDevice = async () => {
    setNotice(null)
    if (!newDeviceName.trim()) {
      setNotice({ type: "error", message: "Device name is required." })
      return
    }
    if (!newDeviceOfficeId) {
      setNotice({ type: "error", message: "Office is required." })
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/fingerprint-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDeviceName.trim(),
          officeId: newDeviceOfficeId,
          status: newDeviceStatus,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to bind fingerprint device."))
      }
      setNewDeviceName("")
      setNotice({ type: "success", message: "Device bound successfully." })
      await loadDevices()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to bind fingerprint device."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const testDevice = async (id: string) => {
    setWorkingId(id)
    setNotice(null)
    try {
      const response = await fetch(`/api/fingerprint-devices/${id}/test`, { method: "POST" })
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to test device connection."))
      }
      setNotice({ type: "success", message: "Device connection test completed." })
      await loadDevices()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to test device connection."
      setNotice({ type: "error", message })
    } finally {
      setWorkingId(null)
    }
  }

  const queueEnrollment = async (id: string) => {
    setWorkingId(id)
    setNotice(null)
    try {
      const response = await fetch(`/api/fingerprint-devices/${id}/queue-enrollment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      })
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to queue enrollment."))
      }
      setNotice({ type: "success", message: "Enrollment queued." })
      await loadDevices()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to queue enrollment."
      setNotice({ type: "error", message })
    } finally {
      setWorkingId(null)
    }
  }

  const deleteDevice = async (id: string) => {
    setWorkingId(id)
    setNotice(null)
    try {
      const response = await fetch(`/api/fingerprint-devices/${id}`, { method: "DELETE" })
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to delete device."))
      }
      setNotice({ type: "success", message: "Device removed." })
      await loadDevices()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete device."
      setNotice({ type: "error", message })
    } finally {
      setWorkingId(null)
    }
  }

  const isBusy = loadingDevices || loadingOffices
  const officeOptions = useMemo(() => offices, [offices])

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Fingerprint Device"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Manage office binding, sync status, and enrollment queue with live APIs."}</p></div></div>
      {notice ? ((notice.type) === "success" ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert> : <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert>) : null}

      <section className="ui-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-main)]">Bind New Device</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs uppercase text-[var(--text-muted)]">Device Name</label>
            <input className="ui-input" value={newDeviceName} onChange={(event) => setNewDeviceName(event.target.value)} placeholder="e.g. ZKTeco-LHR-04" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase text-[var(--text-muted)]">Office</label>
            <select className="ui-select" value={newDeviceOfficeId} onChange={(event) => setNewDeviceOfficeId(event.target.value)}>
              {officeOptions.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase text-[var(--text-muted)]">Initial Status</label>
            <select className="ui-select" value={newDeviceStatus} onChange={(event) => setNewDeviceStatus(event.target.value as FingerprintStatus)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void bindDevice()} disabled={saving || !newDeviceOfficeId}>
            {saving ? "Binding..." : "Bind Device"}
          </Button>
          <Button variant="secondary" onClick={() => void loadDevices()} disabled={isBusy}>
            Refresh
          </Button>
        </div>
      </section>

      <section className="ui-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-main)]">Filters</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs uppercase text-[var(--text-muted)]">Office</label>
            <select className="ui-select" value={filterOfficeId} onChange={(event) => setFilterOfficeId(event.target.value)}>
              <option value="all">All offices</option>
              {officeOptions.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase text-[var(--text-muted)]">Status</label>
            <select className="ui-select" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as "all" | FingerprintStatus)}>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[1000px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-2 text-start text-xs uppercase text-[var(--text-muted)]">Device</th>
              <th className="px-4 py-2 text-start text-xs uppercase text-[var(--text-muted)]">Office</th>
              <th className="px-4 py-2 text-start text-xs uppercase text-[var(--text-muted)]">Last Sync</th>
              <th className="px-4 py-2 text-start text-xs uppercase text-[var(--text-muted)]">Pending Enrollments</th>
              <th className="px-4 py-2 text-start text-xs uppercase text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-2 text-start text-xs uppercase text-[var(--text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-sm">{device.name}</td>
                <td className="px-4 py-2 text-sm">{device.officeName}</td>
                <td className="px-4 py-2 text-sm">{new Date(device.lastSyncAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-sm">{device.pendingEnrollments}</td>
                <td className="px-4 py-2 text-sm">
                  <Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{device.status}</Badge>
                </td>
                <td className="px-4 py-2 text-sm">
                  <div className="flex gap-2">
                    <Button
                      className="px-2 py-1 text-xs"
                      variant="secondary"
                      onClick={() => void testDevice(device.id)}
                      disabled={workingId === device.id}
                    >
                      Test
                    </Button>
                    <Button
                      className="px-2 py-1 text-xs"
                      variant="secondary"
                      onClick={() => void queueEnrollment(device.id)}
                      disabled={workingId === device.id}
                    >
                      Queue +1
                    </Button>
                    <Button
                      className="px-2 py-1 text-xs"
                      variant="secondary"
                      onClick={() => void deleteDevice(device.id)}
                      disabled={workingId === device.id}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!devices.length ? (
          <p className="p-4 text-sm text-[var(--text-muted)]">{loadingDevices ? "Loading fingerprint devices..." : "No fingerprint devices found."}</p>
        ) : null}
      </section>
    </div>
  )
}
