"use client"

import { LucideIcon } from "lucide-react"

interface PlaceholderTabProps {
    title: string
    description: string
    icon: LucideIcon
    data?: any[]
}

export default function PlaceholderTab({ title, description, icon: Icon, data = [] }: PlaceholderTabProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">{title}</h2>

            <div className="bg-white rounded-lg border p-12 text-center">
                <Icon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">{description}</p>
                <p className="text-sm text-gray-500">This tab will display {title.toLowerCase()} information</p>
                {data.length > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                        {data.length} record{data.length !== 1 ? "s" : ""} available
                    </p>
                )}
            </div>
        </div>
    )
}
