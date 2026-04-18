"use client"

import { useState } from "react"

export default function ClientStatusToggle({
  clientId,
  currentStatus,
}: {
  clientId: string
  currentStatus: string
}) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    const next = status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    if (!confirm(`Change client status to ${next}?`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error("Failed")
      setStatus(next)
    } catch {
      alert("Failed to update status. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleToggle}
      className={`ui-btn inline-flex items-center gap-2 disabled:opacity-50 ${
        status === "ACTIVE" ? "ui-btn-danger" : "ui-btn-secondary"
      }`}
    >
      {loading ? "Updating..." : status === "ACTIVE" ? "Set Inactive" : "Set Active"}
    </button>
  )
}
