import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import PrerequisitesManager from "./manager"
import SectionTitle from "@/components/ui/section-title"

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
            <SectionTitle
                title="Prerequisites Management"
                subtitle="Manage regions and regional offices for the guard management system"
            />

            <PrerequisitesManager regions={regions} regionalOffices={regionalOffices} />
        </div>
    )
}
