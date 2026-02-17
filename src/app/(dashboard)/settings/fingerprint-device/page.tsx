"use client"

import { useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import StatusChip from "@/components/ui/status-chip"
import { mockFingerprintDevices } from "@/lib/mockData/fingerprint"

export default function FingerprintDevicePage() {
  const [devices, setDevices] = useState(mockFingerprintDevices)
  const [officeId, setOfficeId] = useState("office-lhr")

  const testConnection = (id: string) => {
    setDevices((prev) => prev.map((item) => (item.id === id ? { ...item, status: "ONLINE", lastSyncAt: new Date().toISOString() } : item)))
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Fingerprint Device" subtitle="Manage device binding, sync status and enrollment queue (mock)." />

      <section className="ui-card p-4 flex flex-wrap items-center gap-2">
        <select className="ui-select w-56" value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
          <option value="office-lhr">Lahore Head Office</option>
          <option value="office-khi">Karachi Regional Office</option>
          <option value="office-isb">Islamabad Regional Office</option>
        </select>
        <ActionButton variant="secondary">Bind New Device</ActionButton>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Device</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Office</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Last Sync</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-sm">{device.name}</td>
                <td className="px-4 py-2 text-sm">{device.officeName}</td>
                <td className="px-4 py-2 text-sm">{new Date(device.lastSyncAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-sm"><StatusChip label={device.status} variant={device.status === "ONLINE" ? "success" : device.status === "WARNING" ? "warning" : "danger"} /></td>
                <td className="px-4 py-2 text-sm">
                  <div className="flex gap-2">
                    <ActionButton className="px-2 py-1 text-xs" variant="secondary" onClick={() => testConnection(device.id)}>Test</ActionButton>
                    <ActionButton className="px-2 py-1 text-xs" variant="secondary">Queue Enrollment</ActionButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
