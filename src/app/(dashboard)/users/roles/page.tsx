import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import RolesManager from "@/components/users/RolesManager"

type TabKey = "roles" | "permissions" | "overrides"

function parseTab(value: string | string[] | undefined): TabKey {
    const v = Array.isArray(value) ? value[0] : value
    if (v === "permissions" || v === "overrides") return v
    return "roles"
}

export default async function RolesPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>
}) {
    const session = await auth()
    if (!session) redirect("/login")

    const { tab } = await searchParams
    const initialTab = parseTab(tab)

    const roles = await prisma.role.findMany({ orderBy: { name: "asc" } }).catch(() => [])

    return (
        <div className="space-y-6">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Roles & Permissions"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Define roles, configure role-level permissions, and assign per-user overrides."}</p></div></div>
            <RolesManager
                initialRoles={roles.map((r) => ({ id: r.id, name: r.name, description: r.description ?? null, scopeType: r.scopeType }))}
                initialTab={initialTab}
            />
        </div>
    )
}
