import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Edit } from "lucide-react"
import GuardProfileTabs from "@/components/guards/GuardProfileTabs"
import ProfileImageCard from "@/components/guards/ProfileImageCard"
import GuardProfileHealth from "@/components/guards/GuardProfileHealth"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import type { GuardTabModel, NearestRelative } from "@/components/guards/tabs/types"

type GuardDetailModel = GuardTabModel & {
    id: string
    parwestId: string
    name: string
    cnic: string
    phone?: string | null
    email?: string | null
    status: string
    regionalOffice?: { name?: string | null } | null
    managerName?: string | null
    joiningAge?: number | null
    enrolledBy?: string | null
    profileIntroducer?: string | null
    nearestRelatives?: NearestRelative[]
}

function toDateOrNull(value?: Date | string | null) {
    if (!value) return null
    const parsed = value instanceof Date ? value : new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function calculateAge(dateOfBirth?: Date | string | null, referenceDate?: Date | string | null) {
    const birthDate = toDateOrNull(dateOfBirth)
    const joinedDate = toDateOrNull(referenceDate)
    if (!birthDate || !joinedDate) return null
    let years = joinedDate.getFullYear() - birthDate.getFullYear()
    const monthDiff = joinedDate.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && joinedDate.getDate() < birthDate.getDate())) {
        years--
    }
    return years >= 0 ? years : null
}

export default async function GuardDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    let dbWarning = ""
    let guard: GuardDetailModel | null = null

    try {
        guard = await prisma.guard.findUnique({
            where: { id },
            include: {
                region: true,
                regionalOffice: true,
            },
        })
    } catch (error) {
        if (!isPrismaMissingSchemaError(error)) {
            throw error
        }
        dbWarning = `Database schema is not fully migrated (${toErrorMessage(
            error,
            "missing required tables"
        )}). Guard profile is unavailable.`
        console.error("GuardDetailPage query failed:", error)
    }

    if (!guard) {
        if (dbWarning) {
            return (
                <div className="space-y-6">
                    <InlineAlert type="error" message={dbWarning} />
                    <div className="ui-card p-6 space-y-4">
                        <h1 className="text-2xl font-semibold text-[var(--text)]">Guard profile unavailable</h1>
                        <p className="text-sm text-[var(--text-muted)]">
                            Guard detail could not be loaded because required database schema is unavailable.
                        </p>
                        <Link href="/guards" className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Guards
                        </Link>
                    </div>
                </div>
            )
        }
        notFound()
    }

    const guardWithTabs = {
        ...guard,
        regionalOffice: guard.regionalOffice?.name || null,
        managerName: guard.managerName || "—",
        joiningAge: guard.joiningAge ?? calculateAge(guard.dateOfBirth ?? null, guard.joiningDate ?? null) ?? null,
        enrolledBy: guard.enrolledBy || "—",
        profileIntroducer: guard.profileIntroducer || "—",
        nearestRelatives: guard.nearestRelatives || [],
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "ACTIVE":
                return "bg-green-100 text-green-800"
            case "INACTIVE":
                return "bg-gray-100 text-gray-800"
            case "PENDING":
                return "bg-orange-100 text-orange-800"
            default:
                return "bg-gray-100 text-gray-800"
        }
    }

    return (
        <div className="space-y-6">
            {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/guards"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Back to Guards
                    </Link>
                </div>
                <Link
                    href={`/guards/${guard.id}/edit`}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <Edit className="h-4 w-4" />
                    Edit Guard
                </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Guard Header Card */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{guard.name}</h1>
                        <p className="text-gray-600 mt-1">Parwest ID: {guard.parwestId}</p>
                        <p className="text-gray-600 mt-1">Supervisor: {guardWithTabs.managerName || "—"}</p>
                        <div className="mt-4">
                            <GuardProfileHealth guard={guardWithTabs} />
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(guard.status)}`}>
                        {guard.status}
                    </span>
                </div>
            </div>
            <ProfileImageCard guardId={guard.id} guardName={guard.name} />
            </div>

            {/* Tabs */}
            <GuardProfileTabs guard={guardWithTabs} baseUrl={`/guards/${guard.id}`} />
        </div>
    )
}
