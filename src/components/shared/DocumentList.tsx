"use client"

import { Download, Eye, FileText, Upload } from "lucide-react"
import { Button } from "@/components/shadcn/button"
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
                <div className="mb-4 flex items-start justify-between gap-4"><h2 className="text-xl font-bold tracking-tight">{(title)}</h2></div>
                <Button onClick={onUpload} className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Document
                </Button>
            </div>

            {documents.length === 0 ? (
                <div className="ui-card p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-[var(--text-muted)]">No documents uploaded yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map((doc) => (
                        <div key={doc.id} className="ui-card p-4 hover:shadow-[var(--shadow-md)] transition-shadow">
                            <div className="flex items-start gap-3">
                                <FileText className="h-8 w-8 text-blue-600" />
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm truncate">{doc.name}</h4>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">{doc.type}</p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString("en-US") : "—"}
                                        {doc.size ? ` • ${doc.size}` : ""}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <button className="ui-btn ui-btn-secondary flex-1 flex items-center justify-center gap-1 text-xs">
                                    <Eye className="h-3 w-3" />
                                    View
                                </button>
                                <button className="ui-btn ui-btn-secondary flex-1 flex items-center justify-center gap-1 text-xs">
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
