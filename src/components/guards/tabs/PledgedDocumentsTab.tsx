"use client"

import { FileCheck2 } from "lucide-react"

interface PledgedDocumentsTabProps {
    documents: any[]
}

export default function PledgedDocumentsTab({ documents }: PledgedDocumentsTabProps) {
    const getStatusColor = (status: string) => {
        if (status === "HELD") return "bg-yellow-100 text-yellow-800"
        if (status === "RETURNED") return "bg-green-100 text-green-800"
        return "bg-gray-100 text-gray-700"
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Pledged Documents</h2>

            {documents.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <FileCheck2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No pledged documents found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {documents.map((doc) => (
                        <div key={doc.id} className="bg-white rounded-lg border p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold">{doc.type}</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Received: {new Date(doc.receivedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(doc.returnStatus)}`}>
                                    {doc.returnStatus}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-3">{doc.notes || "No additional notes."}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
