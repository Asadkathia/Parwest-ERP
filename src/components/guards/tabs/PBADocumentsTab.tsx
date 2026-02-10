"use client"

import { FileText, BadgeCheck } from "lucide-react"

interface PBADocumentsTabProps {
    documents: any[]
}

export default function PBADocumentsTab({ documents }: PBADocumentsTabProps) {
    const getStatusColor = (status: string) => {
        if (status === "VERIFIED") return "bg-green-100 text-green-800"
        if (status === "PENDING") return "bg-yellow-100 text-yellow-800"
        return "bg-gray-100 text-gray-700"
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">PBA Documents</h2>

            {documents.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No PBA documents found</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verification</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {documents.map((doc) => (
                                <tr key={doc.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium">{doc.name}</td>
                                    <td className="px-6 py-4 text-sm">{doc.type}</td>
                                    <td className="px-6 py-4 text-sm">
                                        {doc.uploadedAt
                                            ? new Date(doc.uploadedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                            : "—"}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.verificationStatus)}`}>
                                            {doc.verificationStatus || "—"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <button className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                                            <BadgeCheck className="h-4 w-4" />
                                            View
                                        </button>
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

