import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import SectionTitle from "@/components/ui/section-title"
import RolesManager from "@/components/users/RolesManager"

export default async function RolesPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const roles = await prisma.role.findMany({ orderBy: { name: "asc" } }).catch(() => [])

    return (
        <div className="space-y-6">
            <SectionTitle
                title="Roles & Permissions"
                subtitle="Create roles, define their permissions, and assign them to users."
            />
            <RolesManager initialRoles={roles.map((r) => ({ id: r.id, name: r.name, description: r.description ?? null }))} />
        </div>
    )
}