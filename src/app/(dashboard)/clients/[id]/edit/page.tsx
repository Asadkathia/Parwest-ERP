import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import ClientEditForm from "./form"
import SectionTitle from "@/components/ui/section-title"

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const [client, regions] = await Promise.all([
        prisma.client.findUnique({
            where: { id },
        }),
        prisma.region.findMany({
            orderBy: { name: "asc" },
        }),
    ])

    if (!client) notFound()

    return (
        <div className="space-y-6">
            <SectionTitle title="Edit Client" subtitle={`Update client information for ${client.name}`} />

            <ClientEditForm client={client} regions={regions} />
        </div>
    )
}
