import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import GuardEditForm from "./form"

export default async function EditGuardPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const [guard, regions, regionalOffices] = await Promise.all([
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
    ])

    if (!guard) notFound()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Edit Guard</h1>
                <p className="text-gray-600 mt-1">Update guard information for {guard.name}</p>
            </div>

            <GuardEditForm guard={guard} regions={regions} regionalOffices={regionalOffices} />
        </div>
    )
}
