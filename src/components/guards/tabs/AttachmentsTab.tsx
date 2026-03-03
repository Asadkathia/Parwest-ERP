"use client"

import DocumentList from "@/components/shared/DocumentList"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type AttachmentDocument = {
    id: string
    name: string
    type: string
    uploadedAt?: string
    size?: string
}

interface AttachmentsTabProps {
    attachments: GuardLooseRow[]
}

export default function AttachmentsTab({ attachments }: AttachmentsTabProps) {
    return <DocumentList documents={(attachments || []) as AttachmentDocument[]} title="Attachments" />
}
