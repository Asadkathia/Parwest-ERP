"use client"

import { ShoppingCart } from "lucide-react"
import type { GuardLooseRow } from "@/components/guards/tabs/types"
import Link from "next/link"

type StoreInventoryItem = {
    id: string
    item?: string
    quantity?: number
    issueDate?: string
    returnDate?: string
    status?: string
}

interface StoreInventoryTabProps {
    items: GuardLooseRow[]
}

export default function StoreInventoryTab({ items }: StoreInventoryTabProps) {
    const rows = items as StoreInventoryItem[]
    const getStatusColor = (status: string) => {
        if (status === "ISSUED") return "bg-blue-100 text-blue-800"
        if (status === "RETURNED") return "bg-green-100 text-green-800"
        return "bg-gray-100 text-gray-700"
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-2xl font-bold">Store Inventory</h2>
                <Link href="/store-inventory/inventory-assignments" className="ui-btn ui-btn-secondary">
                    Open Store Inventory V2
                </Link>
            </div>

            {rows.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No store inventory records found</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {rows.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium">{item.item || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{item.quantity || 0}</td>
                                    <td className="px-6 py-4 text-sm">
                                        {item.issueDate
                                            ? new Date(item.issueDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                            : "—"}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {item.returnDate
                                            ? new Date(item.returnDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                            : "Not Returned"}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status || "ISSUED")}`}>
                                            {item.status || "—"}
                                        </span>
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
