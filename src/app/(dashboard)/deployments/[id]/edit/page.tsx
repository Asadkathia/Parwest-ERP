import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, buildManagerScopeWhere, managerScopeDenied } from "@/lib/access/scope"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import DeploymentEditForm from "./form"
import SectionTitle from "@/components/ui/section-title"

export default async function EditDeploymentPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")
    if (!hasAction(session, "GUARDS", "UPDATE")) redirect("/deployments")

    const { id } = await params

    // Scope client + office options to the caller's regional access so a
    // regional admin can't move a deployment into a region they don't manage.
    const scope = deriveManagerScope(session)
    const clientWhere = {
        status: "ACTIVE",
        ...buildManagerScopeWhere(scope, { regionId: "regionId" }),
    }
    const officeWhere = buildManagerScopeWhere(scope, { regionId: "regionId", regionalOfficeId: "id" })

    const [deployment, clients, regionalOffices] = await Promise.all([
        prisma.deployment.findUnique({
            where: { id },
            include: {
                guard: true,
                client: {
                    include: {
                        branches: true,
                    },
                },
                branch: true,
                regionalOffice: { select: { id: true, name: true, seriesCode: true, regionId: true } },
            },
        }),
        prisma.client.findMany({
            where: clientWhere,
            orderBy: { name: "asc" },
            include: {
                branches: {
                    orderBy: { name: "asc" },
                },
            },
        }),
        prisma.regionalOffice.findMany({
            where: officeWhere,
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                seriesCode: true,
            },
        }),
    ])

    if (!deployment) notFound()

    // If the deployment is in a region the caller cannot manage, refuse.
    if (
        managerScopeDenied(scope, {
            regionId: deployment.regionalOffice?.regionId ?? null,
            regionalOfficeId: deployment.regionalOfficeId ?? null,
        })
    ) {
        redirect("/deployments")
    }

    return (
        <div className="space-y-6">
            <SectionTitle title="Change Deployment" subtitle={`Update deployment for ${deployment.guard.name}`} />

            <DeploymentEditForm
                deployment={deployment}
                clients={clients}
                regionalOffices={regionalOffices}
                blockInactiveUpdate={isWorkflowRuleEnabled("deployments.blockInactiveUpdate")}
            />
        </div>
    )
}
