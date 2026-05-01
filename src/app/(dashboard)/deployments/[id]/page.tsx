import { auth } from "@/lib/auth"
import { Card, CardContent, CardHeader } from "@/components/shadcn/card"
import { Badge } from "@/components/shadcn/badge"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import Link from "next/link"
import { ArrowLeft, Building, User, Calendar, FileText } from "lucide-react"
export default async function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  // Deployments are read-only — only revoke is permitted (Ticket 37).
  const canDeleteDeployment = hasAction(session, "GUARDS", "DELETE")

  const { id } = await params

  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: {
      guard: true,
      client: true,
      branch: true,
    },
  })

  if (!deployment) notFound()

  const scope = deriveManagerScope(session)
  if (managerScopeDenied(scope, {
    regionId: deployment.client.regionId ?? deployment.guard.regionId,
    regionalOfficeId: deployment.regionalOfficeId ?? deployment.guard.regionalOfficeId,
  })) {
    notFound()
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4 flex items-center gap-2"><div><h2 className="text-xl font-bold tracking-tight">{"Deployment Details"}</h2><p className="mt-1 text-sm text-muted-foreground">{(`${deployment.guard.name} deployed at ${deployment.client.name}${deployment.branch ? ` - ${deployment.branch.name}` : ""}`)}</p></div><div className="flex shrink-0 items-center gap-2">{(<div className="flex items-center gap-2">
            <Link href="/deployments" className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            {deployment.status === "ACTIVE" && canDeleteDeployment ? (
              <Link href={`/deployments/${deployment.id}/end`} className="ui-btn ui-btn-danger">
                Revoke Deployment
              </Link>
            ) : null}
          </div>)}</div></div>

      <Card>
        <CardContent className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text)]">{deployment.guard.name}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{deployment.client.name}{deployment.branch ? ` - ${deployment.branch.name}` : ""}</p>
          </div>
          <Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{deployment.status}</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <User className="h-4 w-4" />
                Guard Information
              </h3>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-[var(--text-muted)]">Name</p><Link href={`/guards/${deployment.guard.id}`} className="font-medium text-[var(--brand)] hover:underline">{deployment.guard.name}</Link></div>
              <div><p className="text-[var(--text-muted)]">Parwest ID</p><p className="font-medium text-[var(--text)]">{deployment.guard.parwestId}</p></div>
              <div><p className="text-[var(--text-muted)]">CNIC</p><p className="font-medium text-[var(--text)]">{deployment.guard.cnic}</p></div>
              <div><p className="text-[var(--text-muted)]">Phone</p><p className="font-medium text-[var(--text)]">{deployment.guard.phone || "—"}</p></div>
              <div><p className="text-[var(--text-muted)]">Email</p><p className="font-medium text-[var(--text)]">{deployment.guard.email || "—"}</p></div>
              <div><p className="text-[var(--text-muted)]">Status</p><Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{deployment.guard.status}</Badge></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <Building className="h-4 w-4" />
                Client & Branch Information
              </h3>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-[var(--text-muted)]">Client</p><Link href={`/clients/${deployment.client.id}`} className="font-medium text-[var(--brand)] hover:underline">{deployment.client.name}</Link></div>
              <div><p className="text-[var(--text-muted)]">Client Type</p><p className="font-medium text-[var(--text)]">{deployment.client.type}</p></div>
              <div><p className="text-[var(--text-muted)]">Branch Name</p><p className="font-medium text-[var(--text)]">{deployment.branch?.name || "—"}</p></div>
              <div><p className="text-[var(--text-muted)]">Branch Code</p><p className="font-medium text-[var(--text)]">{deployment.branch?.code || "—"}</p></div>
              <div><p className="text-[var(--text-muted)]">City</p><p className="font-medium text-[var(--text)]">{deployment.branch?.city || "—"}</p></div>
              <div><p className="text-[var(--text-muted)]">Province</p><p className="font-medium text-[var(--text)]">{deployment.branch?.province || "—"}</p></div>
              {deployment.branch?.address ? <div className="md:col-span-2"><p className="text-[var(--text-muted)]">Address</p><p className="font-medium text-[var(--text)]">{deployment.branch.address}</p></div> : null}
            </CardContent>
          </Card>

          {deployment.notes ? (
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2"><FileText className="h-4 w-4" />Notes</h3>
              </CardHeader>
              <CardContent><p className="text-sm text-[var(--text)]">{deployment.notes}</p></CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2"><Calendar className="h-4 w-4" />Timeline</h3>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="text-[var(--text-muted)]">Deployment Date</p><p className="font-medium text-[var(--text)]">{formatDate(deployment.deploymentDate)}</p></div>
              <div><p className="text-[var(--text-muted)]">Created</p><p className="font-medium text-[var(--text)]">{formatDate(deployment.createdAt)}</p></div>
              <div><p className="text-[var(--text-muted)]">Last Updated</p><p className="font-medium text-[var(--text)]">{formatDate(deployment.updatedAt)}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)]">Quick Actions</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/guards/${deployment.guard.id}`} className="ui-btn ui-btn-secondary w-full text-left">View Guard Profile</Link>
              <Link href={`/clients/${deployment.client.id}`} className="ui-btn ui-btn-secondary w-full text-left">View Client Details</Link>
              {deployment.status === "ACTIVE" && canDeleteDeployment ? <Link href={`/deployments/${deployment.id}/end`} className="ui-btn ui-btn-danger w-full text-left">Revoke Deployment</Link> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
