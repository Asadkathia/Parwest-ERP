import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import GuardEnrollmentForm from "./form"
import SectionTitle from "@/components/ui/section-title"

export default async function NewGuardPage() {
    const session = await auth()
    if (!session) redirect("/login")

    // Fetch regions and regional offices for dropdowns
    const regions = await prisma.region.findMany({
        orderBy: { name: "asc" },
    })

    const regionalOffices = await prisma.regionalOffice.findMany({
        include: { region: true },
        orderBy: { name: "asc" },
    })

    return (
        <div className="space-y-6">
            <SectionTitle title="Add New Guard" subtitle="Enroll a new security guard into the system" />

            <GuardEnrollmentForm regions={regions} regionalOffices={regionalOffices} />
        </div>
    )
}
