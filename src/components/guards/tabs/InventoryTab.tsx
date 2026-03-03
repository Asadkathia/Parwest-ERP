"use client"

import { Package } from "lucide-react"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type InventoryItem = {
    id: string
    item?: string
    category?: string
    serialNumber?: string
    issuedDate?: string
    condition?: string
}

interface InventoryTabProps {
    inventory: GuardLooseRow[]
}

export default function InventoryTab({ inventory }: InventoryTabProps) {
    const items = inventory as InventoryItem[]
    const uniqueCategories = new Set(items.map((item) => item.category)).size

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Inventory</h2>
                <div className="text-sm text-gray-600">
                    Items: <span className="font-semibold">{items.length}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border p-4">
                    <p className="text-sm text-gray-600">Assigned Items</p>
                    <p className="text-2xl font-bold mt-1">{items.length}</p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                    <p className="text-sm text-gray-600">Item Categories</p>
                    <p className="text-2xl font-bold mt-1">{uniqueCategories}</p>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No inventory assigned</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium">{item.item}</td>
                                    <td className="px-6 py-4 text-sm">{item.category}</td>
                                    <td className="px-6 py-4 text-sm font-mono">{item.serialNumber || "—"}</td>
                                    <td className="px-6 py-4 text-sm">
                                        {item.issuedDate
                                            ? new Date(item.issuedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                            : "—"}
                                    </td>
                                    <td className="px-6 py-4 text-sm">{item.condition || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
