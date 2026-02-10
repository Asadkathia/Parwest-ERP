import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Edit } from "lucide-react"
import GuardProfileTabs from "@/components/guards/GuardProfileTabs"
import { mockGuardProfile } from "@/lib/mockData/guards"

export default async function GuardDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const guard = await prisma.guard.findUnique({
        where: { id },
        include: {
            region: true,
            regionalOffice: true,
        },
    })

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

            {/* Guard Header Card */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{guard.name}</h1>
                        <p className="text-gray-600 mt-1">Parwest ID: {guard.parwestId}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(guard.status)}`}>
                        {guard.status}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <GuardProfileTabs guard={guardWithTabs} baseUrl={`/guards/${guard.id}`} />
        </div>
    )
}
