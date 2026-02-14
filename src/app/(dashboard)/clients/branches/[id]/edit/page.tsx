import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import BranchEditForm from "./form"
import SectionTitle from "@/components/ui/section-title"

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const branch = await prisma.branch.findUnique({
        where: { id },
        include: {
            client: true,
        },
    })

    if (!branch) notFound()

    return (
        <div className="space-y-6">
            <SectionTitle title="Edit Branch" subtitle={`Update branch information for ${branch.name}`} />

            <BranchEditForm branch={branch} />
        </div>
    )
}
