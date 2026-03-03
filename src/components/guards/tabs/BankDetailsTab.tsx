"use client"

import { CreditCard } from "lucide-react"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type BankDetails = {
    bankName?: string
    accountNumber?: string
    accountType?: string
    branchCode?: string
    iban?: string
    cardStatus?: string
}

interface BankDetailsTabProps {
    bankDetails: GuardLooseRow | null | undefined
}

export default function BankDetailsTab({ bankDetails }: BankDetailsTabProps) {
    const details = (bankDetails || {}) as BankDetails
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Bank Details</h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Update Details
                </button>
            </div>

            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Banking Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm text-gray-600">Bank Name</p>
                        <p className="font-medium text-lg">{details.bankName || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Account Number</p>
                        <p className="font-medium text-lg font-mono">{details.accountNumber || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Account Type</p>
                        <p className="font-medium">{details.accountType || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Branch Code</p>
                        <p className="font-medium font-mono">{details.branchCode || "—"}</p>
                    </div>
                    <div className="md:col-span-2">
                        <p className="text-sm text-gray-600">IBAN</p>
                        <p className="font-medium text-lg font-mono">{details.iban || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Card Status</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${details.cardStatus === "ACTIVE"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}>
                            {details.cardStatus || "—"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Bank details are used for salary disbursement. Please ensure all information is accurate.
                </p>
            </div>
        </div>
    )
}
