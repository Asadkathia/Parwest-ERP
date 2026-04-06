import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import UserProfileClient from "./UserProfileClient"

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const [user, roles, regions, offices, auditLogs] = await Promise.all([
        prisma.user.findUnique({
            where: { id },
            select: {
                id: true, name: true, email: true, status: true,
                contactNumber: true, photoUrl: true,
                createdAt: true, lastLoginAt: true,
                role: { select: { id: true, name: true } },
                region: { select: { id: true, name: true } },
                regionalOffice: { select: { id: true, name: true } },
                permissions: {
                    select: { module: true, canCreate: true, canView: true, canUpdate: true, canDelete: true, canRequisition: true },
                    orderBy: { module: "asc" },
                },
                statusHistory: { orderBy: { changedAt: "desc" }, take: 20 },
            },
        }),
        prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.region.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.regionalOffice.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, regionId: true } }).catch(() => []),
        prisma.auditLog.findMany({
            where: { OR: [{ userId: id }, { description: { contains: id } }] },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: { id: true, event: true, module: true, description: true, createdAt: true },
        }).catch(() => []),
    ])

    if (!user) notFound()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isAdmin = (session.user as any)?.role === "Admin"

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Users
                </Link>
            </div>

            <UserProfileClient
                user={{
                    ...user,
                    createdAt: user.createdAt.toISOString(),
                    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
                    statusHistory: user.statusHistory.map((h) => ({
                        ...h,
                        changedAt: h.changedAt.toISOString(),
                    })),
                }}
                roles={roles}
                regions={regions}
                offices={offices.map((o) => ({ ...o, regionId: o.regionId ?? null }))}
                auditLogs={auditLogs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
                isAdmin={isAdmin}
            />
        </div>
    )
}