import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import ClientEnrollmentForm from "./form"
import SectionTitle from "@/components/ui/section-title"

export default async function NewClientPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const regions = await prisma.region.findMany({
        orderBy: { name: "asc" },
    })

    return (
        <div className="space-y-6">
            <SectionTitle title="Add New Client" subtitle="Enroll a new client into the system" />

            <ClientEnrollmentForm regions={regions} />
        </div>
    )
}
