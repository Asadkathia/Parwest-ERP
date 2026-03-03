"use client"

import { LucideIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export interface Tab {
    id: string
    label: string
    icon?: LucideIcon
}

interface TabNavigationProps {
    tabs: Tab[]
    baseUrl: string
}

export default function TabNavigation({ tabs, baseUrl }: TabNavigationProps) {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || tabs[0]?.id

    return (
        <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    const Icon = tab.icon

                    return (
                        <Link
                            key={tab.id}
                            href={`${baseUrl}?tab=${tab.id}`}
                            className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                                ${isActive
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }
                            `}
                        >
                            {Icon && <Icon className="h-4 w-4" />}
                            {tab.label}
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}
