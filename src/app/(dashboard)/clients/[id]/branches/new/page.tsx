import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import BranchForm from "./form"
import SectionTitle from "@/components/ui/section-title"

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
            <SectionTitle title="Add New Branch" subtitle={`Add a new branch for ${client.name}`} />

            <BranchForm clientId={client.id} clientName={client.name} />
        </div>
    )
}
