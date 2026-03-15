"use client"

import ParwestAIAutofill from "@/components/ocr/ParwestAIAutofill"

type Props = {
    target: "guard" | "client"
    onApply: (fields: Record<string, string>) => void
}

export default function OcrUploadPanel({ onApply }: Props) {
    return <ParwestAIAutofill onApply={onApply} />
}
