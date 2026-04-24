import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import Link from "next/link"
import { ArrowLeft, Edit, Building, User, Calendar, FileText } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import StatusChip from "@/components/ui/status-chip"

export default async function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  // Deployments semantically belong to GUARDS module (no dedicated DEPLOYMENTS module).
  const canUpdateDeployment = hasAction(session, "GUARDS", "UPDATE")
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
      <SectionTitle
        title="Deployment Details"
        subtitle={`${deployment.guard.name} deployed at ${deployment.client.name}${deployment.branch ? ` - ${deployment.branch.name}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Link href="/deployments" className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            {deployment.status === "ACTIVE" && canDeleteDeployment ? (
              <Link href={`/deployments/${deployment.id}/end`} className="ui-btn ui-btn-danger">
                End Deployment
              </Link>
            ) : null}
            {!deployment.endDate && canUpdateDeployment ? (
              <Link href={`/deployments/${deployment.id}/edit`} className="ui-btn ui-btn-primary inline-flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </Link>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardBody className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text)]">{deployment.guard.name}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{deployment.client.name}{deployment.branch ? ` - ${deployment.branch.name}` : ""}</p>
          </div>
          <StatusChip label={deployment.status} variant={deployment.status === "ACTIVE" ? "success" : "warning"} />
        </CardBody>
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
            <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-[var(--text-muted)]">Name</p><Link href={`/guards/${deployment.guard.id}`} className="font-medium text-[var(--brand)] hover:underline">{deployment.guard.name}</Link></div>
              <div><p className="text-[var(--text-muted)]">Parwest ID</p><p className="font-medium text-[var(--text)]">{deployment.guard.parwestId}</p></div>
              <div><p className="text-[var(--text-muted)]">CNIC</p><p className="font-medium text-[var(--text)]">{deployment.guard.cnic}</p></div>
              <div><p className="text-[var(--text-muted)]">Phone</p><p className="font-medium text-[var(--text)]">{deployment.guard.phone || "—"}</p></div>
              <div><p className="text-[var(--text-muted)]">Email</p><p className="font-medium text-[var(--text)]">{deployment.guard.email || "—"}</p></div>
              <div><p className="text-[var(--text-muted)]">Status</p><StatusChip label={deployment.guard.status} variant={deployment.guard.status === "ACTIVE" ? "success" : "warning"} /></div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <Building className="h-4 w-4" />
                Client & Branch Information
              </h3>
            </CardHeader>
            <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-[var(--text-muted)]">Client</p><Link href={`/clients/${deployment.client.id}`} className="font-medium text-[var(--brand)] hover:underline">{deployment.client.name}</Link></div>
              <div><p className="text-[var(--text-muted)]">Client Type</p><p className="font-medium text-[var(--text)]">{deployment.client.type}</p></div>
              <div><p className="text-[var(--text-muted)]">Branch Name</p><p className="font-medium text-[var(--text)]">{deployment.branch?.name || "—"}</p></div>
              <div><p className="text-[var(--text-muted)]">Branch Code</p><p className="font-medium text-[var(--text)]">{deployment.branch?.code || "—"}</p></div>
              <div><p className="text-[var(--text-muted)]">City</p><p className="font-medium text-[var(--text)]">{deployment.branch?.city || "—"}</p></div>
              <div><p className="text-[var(--text-muted)]">Province</p><p className="font-medium text-[var(--text)]">{deployment.branch?.province || "—"}</p></div>
              {deployment.branch?.address ? <div className="md:col-span-2"><p className="text-[var(--text-muted)]">Address</p><p className="font-medium text-[var(--text)]">{deployment.branch.address}</p></div> : null}
            </CardBody>
          </Card>

          {deployment.notes ? (
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2"><FileText className="h-4 w-4" />Notes</h3>
              </CardHeader>
              <CardBody><p className="text-sm text-[var(--text)]">{deployment.notes}</p></CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2"><Calendar className="h-4 w-4" />Timeline</h3>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div><p className="text-[var(--text-muted)]">Deployment Date</p><p className="font-medium text-[var(--text)]">{formatDate(deployment.deploymentDate)}</p></div>
              <div><p className="text-[var(--text-muted)]">Created</p><p className="font-medium text-[var(--text)]">{formatDate(deployment.createdAt)}</p></div>
              <div><p className="text-[var(--text-muted)]">Last Updated</p><p className="font-medium text-[var(--text)]">{formatDate(deployment.updatedAt)}</p></div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)]">Quick Actions</h3>
            </CardHeader>
            <CardBody className="space-y-2">
              <Link href={`/guards/${deployment.guard.id}`} className="ui-btn ui-btn-secondary w-full text-left">View Guard Profile</Link>
              <Link href={`/clients/${deployment.client.id}`} className="ui-btn ui-btn-secondary w-full text-left">View Client Details</Link>
              {deployment.status === "ACTIVE" && canDeleteDeployment ? <Link href={`/deployments/${deployment.id}/end`} className="ui-btn ui-btn-danger w-full text-left">End Deployment</Link> : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
