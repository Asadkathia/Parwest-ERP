import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import ClientEnrollmentForm from "./form"

export default async function NewClientPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const regions = await prisma.region.findMany({
        orderBy: { name: "asc" },
    })

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Add New Client</h1>
                <p className="text-gray-600 mt-1">Enroll a new client into the system</p>
            </div>

            <ClientEnrollmentForm regions={regions} />
        </div>
    )
}
