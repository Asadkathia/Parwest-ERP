"use client"

import { Download, Eye, FileText, Upload } from "lucide-react"

type DocumentItem = {
    id: string
    name: string
    type: string
    uploadedAt?: string
    size?: string
}

interface DocumentListProps {
    documents: DocumentItem[]
    title?: string
    onUpload?: () => void
}

export default function DocumentList({ documents, title = "Documents", onUpload }: DocumentListProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">{title}</h2>
                <button onClick={onUpload} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <Upload className="h-4 w-4" />
                    Upload Document
                </button>
            </div>

            {documents.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No documents uploaded yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map((doc) => (
                        <div key={doc.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                                <FileText className="h-8 w-8 text-blue-600" />
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm truncate">{doc.name}</h4>
                                    <p className="text-xs text-gray-500 mt-1">{doc.type}</p>
                                    <p className="text-xs text-gray-500">
                                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString("en-US") : "—"}
                                        {doc.size ? ` • ${doc.size}` : ""}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <button className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded hover:bg-blue-100">
                                    <Eye className="h-3 w-3" />
                                    View
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-1 text-xs bg-gray-50 text-gray-600 px-3 py-2 rounded hover:bg-gray-100">
                                    <Download className="h-3 w-3" />
                                    Download
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
