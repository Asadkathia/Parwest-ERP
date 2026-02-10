import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import GuardEnrollmentForm from "./form"

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
            <div>
                <h1 className="text-3xl font-bold">Add New Guard</h1>
                <p className="text-gray-600 mt-1">Enroll a new security guard into the system</p>
            </div>

            <GuardEnrollmentForm regions={regions} regionalOffices={regionalOffices} />
        </div>
    )
}
