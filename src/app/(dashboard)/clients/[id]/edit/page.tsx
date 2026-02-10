import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import ClientEditForm from "./form"

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
            <div>
                <h1 className="text-3xl font-bold">Edit Client</h1>
                <p className="text-gray-600 mt-1">Update client information for {client.name}</p>
            </div>

            <ClientEditForm client={client} regions={regions} />
        </div>
    )
}
