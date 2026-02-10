"use client"

import { UserCircle2, ShieldCheck, CalendarDays, Clock3 } from "lucide-react"

interface ProfileTabProps {
    guard: any
}

export default function ProfileTab({ guard }: ProfileTabProps) {
    const serviceYears = guard.joiningDate
        ? Math.max(0, Math.floor((Date.now() - new Date(guard.joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 365)))
        : 0

    const metrics = [
        { label: "Years of Service", value: `${serviceYears} yrs`, icon: Clock3 },
        { label: "Deployments", value: `${guard.deployments?.length || 0}`, icon: CalendarDays },
        { label: "Courses Completed", value: `${guard.courses?.length || 0}`, icon: ShieldCheck },
    ]

    const initials = guard.name
        ? guard.name
            .split(" ")
            .map((part: string) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "GD"

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Profile</h2>

            <div className="bg-white rounded-lg border p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="h-24 w-24 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-2xl font-bold">
                        {initials}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-semibold">{guard.name || "—"}</h3>
                        <p className="text-gray-600">{guard.parwestId || "—"}</p>
                        <p className="text-sm text-gray-500 mt-2">
                            Security professional with operational deployment experience across client locations.
                        </p>
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 border rounded-md px-4 py-2 text-sm hover:bg-gray-50">
                        <UserCircle2 className="h-4 w-4" />
                        Update Profile
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metrics.map((metric) => {
                    const Icon = metric.icon
                    return (
                        <div key={metric.label} className="bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600">{metric.label}</p>
                                <Icon className="h-4 w-4 text-blue-600" />
                            </div>
                            <p className="text-2xl font-bold mt-2">{metric.value}</p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
