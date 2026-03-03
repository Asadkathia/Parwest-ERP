"use client"

import { CheckCircle, XCircle, Clock } from "lucide-react"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type VerificationRecord = {
    status?: string
    type?: string
    verifiedBy?: string
    verifiedDate?: string | null
    expiryDate?: string | null
}

interface VerificationTabProps {
    verifications: GuardLooseRow[]
}

export default function VerificationTab({ verifications }: VerificationTabProps) {
    const rows = verifications as VerificationRecord[]
    const formatDate = (date: string | null) => {
        if (!date) return "—"
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "VERIFIED":
                return <CheckCircle className="h-5 w-5 text-green-600" />
            case "PENDING":
                return <Clock className="h-5 w-5 text-yellow-600" />
            case "REJECTED":
                return <XCircle className="h-5 w-5 text-red-600" />
            default:
                return <Clock className="h-5 w-5 text-gray-600" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "VERIFIED":
                return "bg-green-100 text-green-800"
            case "PENDING":
                return "bg-yellow-100 text-yellow-800"
            case "REJECTED":
                return "bg-red-100 text-red-800"
            default:
                return "bg-gray-100 text-gray-800"
        }
    }

    const verifiedCount = rows.filter(v => v.status === "VERIFIED").length
    const pendingCount = rows.filter(v => v.status === "PENDING").length

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Verification Status</h2>
                <div className="flex items-center gap-4">
                    <div className="text-sm">
                        <span className="text-gray-600">Verified: </span>
                        <span className="font-semibold text-green-600">{verifiedCount}/{rows.length}</span>
                    </div>
                    {pendingCount > 0 && (
                        <div className="text-sm">
                            <span className="text-gray-600">Pending: </span>
                            <span className="font-semibold text-yellow-600">{pendingCount}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rows.map((verification, index) => (
                    <div key={index} className="bg-white rounded-lg border p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {getStatusIcon(verification.status || "PENDING")}
                                <div>
                                    <h3 className="font-semibold">{(verification.type || "UNSPECIFIED").replace(/_/g, " ")}</h3>
                                    <p className="text-sm text-gray-600">Verified by: {verification.verifiedBy}</p>
                                </div>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(verification.status || "PENDING")}`}>
                                {verification.status || "PENDING"}
                            </span>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Verified Date:</span>
                                <span className="font-medium">{formatDate(verification.verifiedDate || null)}</span>
                            </div>
                            {verification.expiryDate && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Expiry Date:</span>
                                    <span className="font-medium">{formatDate(verification.expiryDate)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
