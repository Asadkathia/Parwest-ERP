"use client"

import { UserCircle2, ShieldCheck, CalendarDays, Clock3 } from "lucide-react"

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/shadcn/card"
import { Button } from "@/components/shadcn/button"
import type { GuardTabModel } from "@/components/guards/tabs/types"

interface ProfileTabProps {
    guard: GuardTabModel
}

const CURRENT_YEAR = new Date().getFullYear()

export default function ProfileTab({ guard }: ProfileTabProps) {
    const joiningYear = guard.joiningDate ? new Date(guard.joiningDate).getFullYear() : null
    const serviceYears = joiningYear ? Math.max(0, CURRENT_YEAR - joiningYear) : 0

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
            <div>
                <h2 className="text-20 font-bold">Profile</h2>
                <p className="text-sm text-muted-foreground">Overview of guard identity and service metrics.</p>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className="h-24 w-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
                            {initials}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold">{guard.name || "—"}</h3>
                            <p className="text-muted-foreground tabular-nums font-mono">{guard.parwestId || "—"}</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Security professional with operational deployment experience across client locations.
                            </p>
                        </div>
                        <Button variant="outline">
                            <UserCircle2 className="h-4 w-4" />
                            Update Profile
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metrics.map((metric) => {
                    const Icon = metric.icon
                    return (
                        <Card key={metric.label}>
                            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-normal text-muted-foreground">
                                    {metric.label}
                                </CardTitle>
                                <Icon className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold tabular-nums">{metric.value}</p>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
