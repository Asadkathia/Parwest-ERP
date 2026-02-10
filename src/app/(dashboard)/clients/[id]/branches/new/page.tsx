import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import BranchForm from "./form"

export default async function NewBranchPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const client = await prisma.client.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
        },
    })

    if (!client) notFound()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Add New Branch</h1>
                <p className="text-gray-600 mt-1">Add a new branch for {client.name}</p>
            </div>

            <BranchForm clientId={client.id} clientName={client.name} />
        </div>
    )
}
