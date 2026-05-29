"use client"

import { useCallback, useEffect, useState } from "react"
import { ShoppingCart } from "lucide-react"
import Link from "next/link"
import { apiGet } from "@/components/store-inventory-v2/api"

type StoreInventoryRow = {
  id: string
  productName: string
  productSku: string
  productVariation: string | null
  quantity: number
  assignedAt: string
  conditionName: string | null
  assignedByName: string | null
  returnedAt: string | null
  returnConditionName: string | null
  returnedByName: string | null
  status: string
}

interface StoreInventoryTabProps {
  guardId: string
  // legacy prop — kept for backwards compat, ignored
  items?: unknown[]
  canCreate?: boolean
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function StatusBadge({ status }: { status: string }) {
  let cls = "bg-gray-100 text-gray-700"
  if (status === "ASSIGNED") cls = "bg-blue-100 text-blue-800"
  else if (status === "RETURNED") cls = "bg-green-100 text-green-800"
  else if (status === "DAMAGED") cls = "bg-red-100 text-red-800"
  else if (status === "LOST") cls = "bg-orange-100 text-orange-800"
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

export default function StoreInventoryTab({ guardId, canCreate = false }: StoreInventoryTabProps) {
  const [rows, setRows] = useState<StoreInventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [returningId, setReturningId] = useState<string | null>(null)

  const loadRows = useCallback(() => {
    if (!guardId) return
    setLoading(true)
    setError(null)
    apiGet<StoreInventoryRow[]>(`/api/guards/${encodeURIComponent(guardId)}/store-inventory`)
      .then((data) => {
        setRows(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to load store inventory:", err)
        setError("Failed to load inventory records.")
        setLoading(false)
      })
  }, [guardId])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  const handleReturn = useCallback(
    async (row: StoreInventoryRow) => {
      if (typeof window !== "undefined") {
        const confirmed = window.confirm(
          `Return "${row.productName}" (qty ${row.quantity}) to store?`,
        )
        if (!confirmed) return
      }
      const notes =
        typeof window !== "undefined"
          ? window.prompt("Optional notes (leave blank to skip):") ?? ""
          : ""

      setReturningId(row.id)
      try {
        const res = await fetch(
          `/api/store-inventory/v2/assignments/${encodeURIComponent(row.id)}/return`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "RETURNED",
              ...(notes.trim() ? { notes: notes.trim() } : {}),
            }),
          },
        )
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean
          message?: string
        }
        if (!res.ok || data.success === false) {
          const msg = data.message || "Failed to return item."
          if (typeof window !== "undefined") window.alert(msg)
          return
        }
        loadRows()
      } catch (err) {
        console.error("Return assignment failed:", err)
        if (typeof window !== "undefined") window.alert("Failed to return item.")
      } finally {
        setReturningId(null)
      }
    },
    [loadRows],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold">Store Inventory</h2>
        <Link href="/store-inventory/inventory-assignments" className="ui-btn ui-btn-secondary">
          Open Store Inventory V2
        </Link>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <p className="text-gray-500">Loading inventory records...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No store inventory records found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Variant / SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Assign Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Assigning Condition</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Assigned By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Revoking Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Revoking Condition</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Revoked By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{row.productName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.productVariation ? (
                      <span>
                        {row.productVariation}
                        <span className="text-gray-400 ml-1">({row.productSku})</span>
                      </span>
                    ) : (
                      row.productSku || "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.quantity}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.assignedAt)}</td>
                  <td className="px-4 py-3">{row.conditionName || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.assignedByName || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.returnedAt)}</td>
                  <td className="px-4 py-3">{row.returnConditionName || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.returnedByName || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.status === "ASSIGNED" && canCreate ? (
                      <button
                        type="button"
                        onClick={() => handleReturn(row)}
                        disabled={returningId === row.id}
                        className="ui-btn ui-btn-secondary text-xs disabled:opacity-50"
                      >
                        {returningId === row.id ? "Returning..." : "Return"}
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}