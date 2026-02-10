import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import BranchEditForm from "./form"

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
            <div>
                <h1 className="text-3xl font-bold">Edit Branch</h1>
                <p className="text-gray-600 mt-1">Update branch information for {branch.name}</p>
            </div>

            <BranchEditForm branch={branch} />
        </div>
    )
}
