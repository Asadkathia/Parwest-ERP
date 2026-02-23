import { type ReactNode } from "react"
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Edit, FileText, Plus } from "lucide-react"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import SectionTitle from "@/components/ui/section-title"
import StatusChip from "@/components/ui/status-chip"

type TabKey =
  | "general-information"
  | "assigned-guards"
  | "extra-guards"
  | "branches"
  | "pricing"
  | "attachments"
  | "inventory"
  | "client-invoicing"
  | "contact-information"

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "general-information", label: "GENERAL INFORMATION" },
  { key: "assigned-guards", label: "ASSIGNED GUARDS" },
  { key: "extra-guards", label: "EXTRA GUARDS" },
  { key: "branches", label: "BRANCHES" },
  { key: "pricing", label: "PRICING" },
  { key: "attachments", label: "ATTACHMENTS" },
  { key: "inventory", label: "INVENTORY" },
  { key: "client-invoicing", label: "CLIENT INVOICING" },
  { key: "contact-information", label: "CONTACT INFORMATION" },
]

function isTab(value: string | undefined): value is TabKey {
  return !!value && TABS.some((tab) => tab.key === value)
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function getZipCode(address: string | null | undefined) {
  if (!address) return "—"
  const match = address.match(/\b\d{5}\b/)
  return match ? match[0] : "—"
}

function normalizeShift(shift: string | null | undefined) {
  const value = (shift || "").toUpperCase()
  if (value === "DAY" || value === "NIGHT" || value === "BOTH") return value
  return "—"
}

function normalizeDesignation(value: string | null | undefined) {
  if (!value) return "—"
  return value
}

function startsWithLabel(value: string, prefix: string) {
  return value.toLowerCase().includes(prefix.toLowerCase())
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params
  const { tab: tabParam } = await searchParams
  const activeTab: TabKey = isTab(tabParam) ? tabParam : "general-information"

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      region: true,
      branches: {
        include: {
          deployments: {
            include: {
              guard: true,
            },
          },
        },
        orderBy: { name: "asc" },
      },
      pricingConfigs: {
        orderBy: { guardType: "asc" },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
      },
      inventoryAssignments: {
        include: { item: { include: { category: true } } },
        orderBy: { assignedAt: "desc" },
      },
    },
  })

  if (!client) notFound()

  const allDeployments = client.branches.flatMap((branch) =>
    (branch.deployments || []).map((deployment) => ({ branch, deployment }))
  )

  const activeDeploymentRows = allDeployments.filter((row) => row.deployment.status === "ACTIVE")
  const extraDeploymentRows = activeDeploymentRows.filter((row) => row.deployment.isExtraGuard)

  const uniqueDayGuardIds = new Set(
    activeDeploymentRows
      .filter((row) => {
        const shift = normalizeShift(row.deployment.shiftType)
        return shift === "DAY" || shift === "BOTH"
      })
      .map((row) => row.deployment.guardId)
  )

  const uniqueNightGuardIds = new Set(
    activeDeploymentRows
      .filter((row) => {
        const shift = normalizeShift(row.deployment.shiftType)
        return shift === "NIGHT" || shift === "BOTH"
      })
      .map((row) => row.deployment.guardId)
  )

  const locationSupervisors = activeDeploymentRows.filter((row) =>
    startsWithLabel(row.deployment.designation || "", "supervisor")
  ).length

  const cpoCount = activeDeploymentRows.filter((row) =>
    startsWithLabel(row.deployment.designation || "", "cpo")
  ).length

  const guardLessBranches = client.branches.filter(
    (branch) => !(branch.deployments || []).some((deployment) => deployment.status === "ACTIVE")
  ).length

  const headAddress = client.headOfficeAddress || client.branches[0]?.address || "—"
  const primaryBranch = client.branches[0]
  const attachments = [
    {
      id: "client-logo",
      documentName: "Client Logo",
      parwest: client.name,
      uploadedAt: client.updatedAt,
      available: Boolean(client.logoUrl),
    },
    {
      id: "client-contract",
      documentName: "Contract",
      parwest: client.name,
      uploadedAt: client.updatedAt,
      available: Boolean(client.contractUrl),
    },
  ]

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`${client.name} - PROFILE V2`}
        subtitle="Legacy-aligned client profile view"
        action={
          <div className="flex items-center gap-2">
            <Link href="/clients" className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Link href={`/clients/${client.id}/edit`} className="ui-btn ui-btn-primary inline-flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-2">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab
          return (
            <Link
              key={tab.key}
              href={`/clients/${client.id}?tab=${tab.key}`}
              className={isActive ? "ui-btn ui-btn-primary" : "ui-btn ui-btn-secondary"}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {activeTab === "general-information" ? (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text)]">GENERAL INFORMATION</h2>
            <Link href={`/clients/${client.id}/edit`} className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Link>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-3">
                {client.logoUrl ? (
                  <img
                    src={client.logoUrl}
                    alt={client.name}
                    className="h-48 w-full rounded-[var(--radius-md)] border border-[var(--border)] object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-sm text-[var(--text-muted)]">
                    PHOTO NOT AVAILABLE
                  </div>
                )}
                <button type="button" className="ui-btn ui-btn-primary w-full">
                  UPLOAD PICTURE
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoCell label="NAME" value={client.name} />
                <InfoCell label="EMAIL" value={client.email || "—"} />
                <InfoCell label="CURRENT STATUS" value={client.status} />
                <InfoCell label="CHANGE STATUS" value="CLICK TO CHANGE STATUS" accent />

                <InfoCell label="CLIENT TYPE" value={client.type} />
                <InfoCell label="CITY" value={client.city || "—"} />
                <InfoCell label="ADDRESS" value={headAddress} />
                <InfoCell label="ZIP CODE" value={getZipCode(headAddress)} />

                <InfoCell label="BRANCHES" value={String(client.branches.length)} />
                <InfoCell label="DAY DUTY GUARDS" value={String(uniqueDayGuardIds.size)} />
                <InfoCell label="NIGHT DUTY GUARDS" value={String(uniqueNightGuardIds.size)} />
                <InfoCell label="LOCATION SUPERVISORS" value={String(locationSupervisors)} />

                <InfoCell label="CPO" value={String(cpoCount)} />
                <InfoCell label="GUARD LESS BRANCHES" value={String(guardLessBranches)} accent />
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {activeTab === "assigned-guards" ? (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-[var(--text)]">ASSIGNED GUARDS</h2>
          </CardHeader>
          <CardBody>
            {activeDeploymentRows.length === 0 ? (
              <EmptyTableMessage message="No assigned guards found." />
            ) : (
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>PARWEST ID</Th>
                    <Th>GUARD NAME</Th>
                    <Th>BRANCH</Th>
                    <Th>DESIGNATION</Th>
                    <Th>SHIFT</Th>
                    <Th>DEPLOYMENT TYPE</Th>
                  </tr>
                </thead>
                <tbody>
                  {activeDeploymentRows.map(({ deployment, branch }) => (
                    <tr key={deployment.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <Td>{deployment.guard?.parwestId || "—"}</Td>
                      <Td>{deployment.guard?.name || "—"}</Td>
                      <Td>{branch.name}</Td>
                      <Td>{normalizeDesignation(deployment.designation)}</Td>
                      <Td>{normalizeShift(deployment.shiftType)}</Td>
                      <Td>{deployment.deploymentType || "REGULAR"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </CardBody>
        </Card>
      ) : null}

      {activeTab === "extra-guards" ? (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-[var(--text)]">EXTRA GUARDS</h2>
          </CardHeader>
          <CardBody>
            {extraDeploymentRows.length === 0 ? (
              <EmptyTableMessage message="No extra guard deployment records found." />
            ) : (
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>PARWEST ID</Th>
                    <Th>GUARD NAME</Th>
                    <Th>BRANCH</Th>
                    <Th>SHIFT</Th>
                    <Th>DEPLOYMENT DATE</Th>
                  </tr>
                </thead>
                <tbody>
                  {extraDeploymentRows.map(({ deployment, branch }) => (
                    <tr key={deployment.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <Td>{deployment.guard?.parwestId || "—"}</Td>
                      <Td>{deployment.guard?.name || "—"}</Td>
                      <Td>{branch.name}</Td>
                      <Td>{normalizeShift(deployment.shiftType)}</Td>
                      <Td>{formatDate(deployment.deploymentDate)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </CardBody>
        </Card>
      ) : null}

      {activeTab === "branches" ? (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text)]">BRANCHES</h2>
            <Link href={`/clients/${client.id}/branches/new`} className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Branch
            </Link>
          </CardHeader>
          <CardBody>
            {client.branches.length === 0 ? (
              <EmptyTableMessage message="No branches found for this client." />
            ) : (
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>NAME</Th>
                    <Th>CITY</Th>
                    <Th>ADDRESS</Th>
                    <Th>CONTACT PERSON</Th>
                    <Th>ACTIVE DEPLOYMENTS</Th>
                  </tr>
                </thead>
                <tbody>
                  {client.branches.map((branch) => (
                    <tr key={branch.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <Td>
                        <Link href={`/clients/branches/${branch.id}`} className="text-[var(--brand)] hover:underline">
                          {branch.name}
                        </Link>
                      </Td>
                      <Td>{branch.city || "—"}</Td>
                      <Td>{branch.address || "—"}</Td>
                      <Td>{branch.contactPerson || "—"}</Td>
                      <Td>{(branch.deployments || []).filter((d) => d.status === "ACTIVE").length}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </CardBody>
        </Card>
      ) : null}

      {activeTab === "pricing" ? (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text)]">PRICING</h2>
            <Link href="/clients/pricing" className="ui-btn ui-btn-secondary">Open Pricing Module</Link>
          </CardHeader>
          <CardBody>
            {client.pricingConfigs.length === 0 ? (
              <EmptyTableMessage message="No pricing profiles configured." />
            ) : (
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>GUARD TYPE</Th>
                    <Th>RATE</Th>
                    <Th>UPDATED</Th>
                  </tr>
                </thead>
                <tbody>
                  {client.pricingConfigs.map((config) => (
                    <tr key={config.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <Td>{config.guardType}</Td>
                      <Td>{config.rate.toLocaleString()}</Td>
                      <Td>{formatDate(config.updatedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </CardBody>
        </Card>
      ) : null}

      {activeTab === "attachments" ? (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text)]">ATTACHMENTS</h2>
            <button type="button" className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Upload Attachment
            </button>
          </CardHeader>
          <CardBody>
            <TableWrapper>
              <thead>
                <tr>
                  <Th>DOCUMENT NAME</Th>
                  <Th>PARWEST</Th>
                  <Th>UPLOADED</Th>
                  <Th>ACTION</Th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((doc) => (
                  <tr key={doc.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                    <Td>{doc.documentName}</Td>
                    <Td>{doc.parwest}</Td>
                    <Td>{formatDate(doc.uploadedAt)}</Td>
                    <Td>
                      {doc.available ? (
                        <button type="button" className="text-[var(--brand)] hover:underline">
                          View
                        </button>
                      ) : (
                        <span className="text-[var(--text-muted)]">Not uploaded</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          </CardBody>
        </Card>
      ) : null}

      {activeTab === "inventory" ? (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text)]">INVENTORY</h2>
            <Link href="/inventory/assign-item" className="ui-btn ui-btn-secondary">Open Inventory Assignment</Link>
          </CardHeader>
          <CardBody>
            {client.inventoryAssignments.length === 0 ? (
              <EmptyTableMessage message="No inventory assigned to this client." />
            ) : (
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>ITEM</Th>
                    <Th>CATEGORY</Th>
                    <Th>UNIQUE NO.</Th>
                    <Th>ASSIGNED AT</Th>
                  </tr>
                </thead>
                <tbody>
                  {client.inventoryAssignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <Td>{assignment.item?.serialNumber || assignment.item?.uniqueNumber || "—"}</Td>
                      <Td>{assignment.item?.category?.name || "—"}</Td>
                      <Td>{assignment.item?.uniqueNumber || "—"}</Td>
                      <Td>{formatDate(assignment.assignedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </CardBody>
        </Card>
      ) : null}

      {activeTab === "client-invoicing" ? (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text)]">CLIENT INVOICING</h2>
            <Link href="/clients/invoicing" className="ui-btn ui-btn-secondary">
              Open Invoicing Module
            </Link>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <FieldDisplay label="Client Provinces" value={client.region?.name || "Punjab"} />
              <FieldDisplay label="Client Cities" value={client.city || "Lahore"} />
              <FieldDisplay label="Guard Types" value="Guard" />
              <FieldDisplay label="Invoice Month *" value={new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })} />
            </div>

            {client.invoices.length === 0 ? (
              <EmptyTableMessage message="No invoice rows available." />
            ) : (
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>INVOICE #</Th>
                    <Th>MONTH</Th>
                    <Th>AMOUNT</Th>
                    <Th>STATUS</Th>
                    <Th>DUE DATE</Th>
                  </tr>
                </thead>
                <tbody>
                  {client.invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <Td>{invoice.invoiceNumber}</Td>
                      <Td>{formatDate(invoice.month)}</Td>
                      <Td>{invoice.amount.toLocaleString()}</Td>
                      <Td>{invoice.status}</Td>
                      <Td>{formatDate(invoice.dueDate)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </CardBody>
        </Card>
      ) : null}

      {activeTab === "contact-information" ? (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-[var(--text)]">CONTACT INFORMATION</h2>
          </CardHeader>
          <CardBody className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">BASIC INFORMATION</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FieldDisplay label="NAME" value={client.name} />
                <FieldDisplay label="EMAIL *" value={client.email || "—"} />
                <FieldDisplay label="CONTACT NUMBER" value={primaryBranch?.contactPhone || "—"} />
                <FieldDisplay label="HEAD OFFICE ADDRESS" value={client.headOfficeAddress || "—"} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">CONTACT PERSON INFO</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FieldDisplay label="NAME" value={primaryBranch?.contactPerson || "—"} />
                <FieldDisplay label="CNIC #" value="—" />
                <FieldDisplay label="PHONE NUMBER" value={primaryBranch?.contactPhone || "—"} />
                <FieldDisplay label="EMAIL" value={primaryBranch?.contactEmail || "—"} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">BRANCH MANAGER'S INFORMATION</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FieldDisplay label="Manager *" value={primaryBranch?.contactPerson || "—"} />
                <FieldDisplay label="Manager Contact Number *" value={primaryBranch?.contactPhone || "—"} />
                <FieldDisplay label="NUMBER" value={primaryBranch?.contactPhone || "—"} />
                <FieldDisplay label="EMAIL" value={primaryBranch?.contactEmail || "—"} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">OPERATIONS MANAGER'S INFORMATION</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FieldDisplay label="Manager *" value={primaryBranch?.contactPerson || "—"} />
                <FieldDisplay label="Manager Contact Number" value={primaryBranch?.contactPhone || "—"} />
                <FieldDisplay label="Select City" value={primaryBranch?.city || client.city || "—"} />
                <FieldDisplay label="EMAIL" value={primaryBranch?.contactEmail || "—"} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">SUPERVISOR'S INFORMATION</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FieldDisplay label="Supervisor *" value={activeDeploymentRows[0]?.deployment?.guard?.name || "—"} />
                <FieldDisplay label="Supervisor Contact Number *" value={activeDeploymentRows[0]?.deployment?.guard?.phone || "—"} />
                <FieldDisplay label="REGION" value={client.region?.name || "—"} />
                <FieldDisplay label="BRANCHLESS" value={client.isBranchless ? "Yes" : "No"} />
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="pt-2">
        <StatusChip label={client.status} variant={client.status === "ACTIVE" ? "success" : "warning"} />
      </div>
    </div>
  )
}

function InfoCell({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className={accent ? "mt-1 text-sm font-semibold text-emerald-700" : "mt-1 text-sm font-semibold text-[var(--text)]"}>{value}</p>
    </div>
  )
}

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)]">
        {value}
      </div>
    </div>
  )
}

function EmptyTableMessage({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
      {message}
    </div>
  )
}

function TableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
      <table className="min-w-full border-collapse bg-white text-sm">{children}</table>
    </div>
  )
}

function Th({ children }: { children: ReactNode }) {
  return <th className="bg-[var(--surface-muted)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{children}</th>
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 text-sm text-[var(--text)]">{children}</td>
}
