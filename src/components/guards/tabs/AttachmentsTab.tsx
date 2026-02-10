"use client"

import DocumentList from "@/components/shared/DocumentList"

interface AttachmentsTabProps {
    attachments: any[]
}

export default function AttachmentsTab({ attachments }: AttachmentsTabProps) {
    return <DocumentList documents={attachments || []} title="Attachments" />
}
