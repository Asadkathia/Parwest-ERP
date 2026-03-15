import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import GuardEditForm from "./form"

export default async function EditGuardPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const [guard, regions, regionalOffices, supervisors, currentAssignment] = await Promise.all([
        prisma.guard.findUnique({
            where: { id },
        }),
        prisma.region.findMany({
            orderBy: { name: "asc" },
        }),
        prisma.regionalOffice.findMany({
            include: { region: true },
            orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
            where: { status: "ACTIVE" },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
        }),
        prisma.guardSupervisorAssignment.findFirst({
            where: { guardId: id, status: "ACTIVE" },
            select: { supervisorId: true },
        }),
    ])

    if (!guard) notFound()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Edit Guard</h1>
                <p className="text-gray-600 mt-1">Update guard information for {guard.name}</p>
            </div>

            <GuardEditForm
                guard={guard}
                regions={regions}
                regionalOffices={regionalOffices}
                supervisors={supervisors}
                currentSupervisorId={currentAssignment?.supervisorId ?? null}
            />
        </div>
    )
}
