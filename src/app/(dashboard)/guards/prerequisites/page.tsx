import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import PrerequisitesManager from "./manager"

export default async function PrerequisitesPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const [regions, regionalOffices] = await Promise.all([
        prisma.region.findMany({
            orderBy: { name: "asc" },
        }),
        prisma.regionalOffice.findMany({
            include: {
                region: true,
            },
            orderBy: { name: "asc" },
        }),
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Prerequisites Management</h1>
                <p className="text-gray-600 mt-1">
                    Manage regions and regional offices for the guard management system
                </p>
            </div>

            <PrerequisitesManager regions={regions} regionalOffices={regionalOffices} />
        </div>
    )
}
