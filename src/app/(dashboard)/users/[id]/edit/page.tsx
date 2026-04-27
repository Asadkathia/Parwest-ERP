import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"
import { deriveRegionalScope } from "@/lib/access/scope"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import UserEditForm from "./form"

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")
    if (!hasAction(session, "USERS", "UPDATE")) redirect("/users")

    const { id } = await params
    const scope = deriveRegionalScope(session)
    const superAdmin = isSuperAdmin(session)

    // Regional users only see their own region/offices in the dropdowns; SuperAdmin sees all.
    const regionWhere = scope?.regionId ? { id: scope.regionId } : {}
    const officeWhere = scope?.regionId ? { regionId: scope.regionId } : {}

    const [user, roles, regions, offices] = await Promise.all([
        prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                status: true,
                contactNumber: true,
                roleId: true,
                regionId: true,
                regionalOfficeId: true,
            },
        }),
        prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, scopeType: true } }),
        prisma.region.findMany({ where: regionWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.regionalOffice
            .findMany({ where: officeWhere, orderBy: { name: "asc" }, select: { id: true, name: true, regionId: true } })
            .catch(() => []),
    ])

    if (!user) notFound()

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link
                    href={`/users/${user.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to User
                </Link>
            </div>

            <div>
                <h1 className="text-3xl font-bold">Edit User</h1>
                <p className="text-gray-600 mt-1">Update user information for {user.name}</p>
            </div>

            <UserEditForm
                user={user}
                roles={roles}
                regions={regions}
                offices={offices.map((o) => ({ ...o, regionId: o.regionId ?? null }))}
                isSuperAdmin={superAdmin}
                lockedRegionId={!superAdmin && scope?.regionId ? scope.regionId : null}
                lockedOfficeId={
                    !superAdmin && scope?.regionalOfficeIds?.length === 1 ? scope.regionalOfficeIds[0] : null
                }
            />
        </div>
    )
}
