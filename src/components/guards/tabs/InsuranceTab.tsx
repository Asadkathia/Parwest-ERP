"use client"

import { Shield } from "lucide-react"

interface InsuranceTabProps {
    insurance: any[]
}

export default function InsuranceTab({ insurance }: InsuranceTabProps) {
    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency: "PKR",
            minimumFractionDigits: 0,
        }).format(amount)

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Insurance</h2>

            {insurance.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No insurance policies found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {insurance.map((policy) => (
                        <div key={policy.id} className="bg-white rounded-lg border p-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">{policy.provider || "Insurance Provider"}</h3>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${policy.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                                    {policy.status || "—"}
                                </span>
                            </div>
                            <div className="space-y-2 mt-4 text-sm">
                                <p><span className="text-gray-600">Policy #:</span> <span className="font-medium">{policy.policyNumber || "—"}</span></p>
                                <p><span className="text-gray-600">Coverage:</span> <span className="font-medium">{formatCurrency(policy.coverageAmount || 0)}</span></p>
                                <p><span className="text-gray-600">Beneficiary:</span> <span className="font-medium">{policy.beneficiary || "—"}</span></p>
                                <p><span className="text-gray-600">Start:</span> <span className="font-medium">{policy.startDate ? new Date(policy.startDate).toLocaleDateString("en-US") : "—"}</span></p>
                                <p><span className="text-gray-600">Expiry:</span> <span className="font-medium">{policy.expiryDate ? new Date(policy.expiryDate).toLocaleDateString("en-US") : "—"}</span></p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

