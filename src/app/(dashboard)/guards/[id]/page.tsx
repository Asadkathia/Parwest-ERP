import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Edit } from "lucide-react"
import GuardProfileTabs from "@/components/guards/GuardProfileTabs"
import { mockGuardProfile, mockGuardsList } from "@/lib/mockData/guards"
import ProfileImageCard from "@/components/guards/ProfileImageCard"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"

function calculateAge(dateOfBirth?: Date | null, referenceDate?: Date | null) {
    if (!dateOfBirth || !referenceDate) return null
    let years = referenceDate.getFullYear() - dateOfBirth.getFullYear()
    const monthDiff = referenceDate.getMonth() - dateOfBirth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dateOfBirth.getDate())) {
        years--
    }
    return years >= 0 ? years : null
}

export default async function GuardDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    let dbWarning = ""
    let guard: any = null

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

        const fallbackGuard =
            mockGuardsList.find((item) => item.id === id) ??
            mockGuardsList[0] ??
            mockGuardProfile

        guard = {
            id,
            parwestId: fallbackGuard.parwestId ?? "—",
            name: fallbackGuard.name ?? "Unknown Guard",
            cnic: fallbackGuard.cnic ?? "—",
            phone: fallbackGuard.phone ?? null,
            email: fallbackGuard.email ?? null,
            status: fallbackGuard.status ?? "PENDING",
            dateOfBirth: null,
            joiningDate: null,
            region: null,
            regionalOffice: null,
        }
        dbWarning = `Database schema is not fully migrated (${toErrorMessage(
            error,
            "missing required tables"
        )}). Showing fallback profile data.`
        console.error("GuardDetailPage query failed:", error)
    }

    if (!guard) notFound()

    // Merge database guard with mock data for tabs
    const guardWithTabs = {
        ...guard,
        ...mockGuardProfile,
        id: guard.id,
        parwestId: guard.parwestId,
        name: guard.name,
        cnic: guard.cnic,
        phone: guard.phone,
        email: guard.email,
        status: guard.status,
        regionalOffice: guard.regionalOffice?.name || mockGuardProfile.regionalOffice,
        supervisorName: (mockGuardProfile as { supervisorName?: string }).supervisorName || "Fazal Mehdi",
        managerName: (guard as any).managerName || (mockGuardProfile as { managerName?: string }).managerName || "—",
        joiningAge:
            (guard as any).joiningAge ??
            calculateAge(guard.dateOfBirth, guard.joiningDate) ??
            (mockGuardProfile as { joiningAge?: number }).joiningAge ??
            null,
        enrolledBy: (guard as any).enrolledBy || (mockGuardProfile as { enrolledBy?: string }).enrolledBy || "—",
        profileIntroducer:
            (guard as any).profileIntroducer ||
            (mockGuardProfile as { profileIntroducer?: string }).profileIntroducer ||
            "—",
        nearestRelatives:
            (guard as any).nearestRelatives ||
            (mockGuardProfile as { nearestRelatives?: Array<Record<string, string>> }).nearestRelatives ||
            [],
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
                        <p className="text-gray-600 mt-1">Supervisor: {guardWithTabs.supervisorName}</p>
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
