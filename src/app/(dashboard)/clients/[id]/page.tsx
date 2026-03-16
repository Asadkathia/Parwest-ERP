import { type ReactNode } from "react"
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import Image from "next/image"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Edit, FileText, Plus, Paperclip, Building2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react"
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

function toIsoDate(value: Date | null | undefined) {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

function startsWithLabel(value: string, prefix: string) {
  return value.toLowerCase().includes(prefix.toLowerCase())
}

function toSafeNumber(value: string | undefined, fallback: number) {
  const n = Number.parseInt(value || "", 10)
  if (Number.isNaN(n) || n <= 0) return fallback
  return n
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    tab?: string
    search?: string
    show?: string
    selectDate?: string
    branch?: string
    startDate?: string
    endDate?: string
    supervisor?: string
    manager?: string
  }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params
  const {
    tab: tabParam,
    search: listSearch = "",
    show = "10",
    selectDate = "",
    branch = "",
    startDate = "",
    endDate = "",
    supervisor = "",
    manager = "",
  } = await searchParams
  const activeTab: TabKey = isTab(tabParam) ? tabParam : "general-information"
  const showCount = toSafeNumber(show, 10)

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

  const normalizedSearch = listSearch.trim().toLowerCase()
  const normalizedBranch = branch.trim().toLowerCase()
  const normalizedSupervisor = supervisor.trim().toLowerCase()
  const normalizedManager = manager.trim().toLowerCase()

  const filteredAssignedRows = activeDeploymentRows
    .filter(({ deployment, branch: deploymentBranch }) => {
      const guardName = deployment.guard?.name?.toLowerCase() || ""
      const guardParwest = deployment.guard?.parwestId?.toLowerCase() || ""
      const branchName = deploymentBranch.name?.toLowerCase() || ""
      const branchContact = deploymentBranch.contactPerson?.toLowerCase() || ""
      const branchManagerValue = deploymentBranch.contactPerson?.toLowerCase() || ""

      if (normalizedSearch && !guardName.includes(normalizedSearch) && !guardParwest.includes(normalizedSearch) && !branchName.includes(normalizedSearch)) return false
      if (normalizedBranch && !branchName.includes(normalizedBranch)) return false
      if (normalizedSupervisor && !branchContact.includes(normalizedSupervisor) && !guardName.includes(normalizedSupervisor)) return false
      if (normalizedManager && !branchManagerValue.includes(normalizedManager)) return false
      if (selectDate && toIsoDate(deployment.deploymentDate) !== selectDate) return false
      return true
    })
    .slice(0, showCount)

  const filteredExtraRows = extraDeploymentRows
    .filter(({ deployment, branch: deploymentBranch }) => {
      const guardName = deployment.guard?.name?.toLowerCase() || ""
      const branchName = deploymentBranch.name?.toLowerCase() || ""
      if (normalizedSearch && !guardName.includes(normalizedSearch) && !branchName.includes(normalizedSearch)) return false
      if (normalizedBranch && !branchName.includes(normalizedBranch)) return false
      if (startDate && !deployment.deploymentDate) return false
      if (endDate && !deployment.deploymentDate) return false
      if (selectDate && toIsoDate(deployment.deploymentDate) !== selectDate) return false
      return true
    })
    .slice(0, showCount)

  const filteredBranches = client.branches
    .filter((branchRow) => {
      const name = branchRow.name?.toLowerCase() || ""
      const city = branchRow.city?.toLowerCase() || ""
      const address = branchRow.address?.toLowerCase() || ""
      const contact = branchRow.contactPerson?.toLowerCase() || ""

      if (normalizedSearch && !name.includes(normalizedSearch) && !city.includes(normalizedSearch) && !address.includes(normalizedSearch) && !contact.includes(normalizedSearch)) return false
      if (selectDate && toIsoDate(branchRow.updatedAt) !== selectDate) return false
      return true
    })
    .slice(0, showCount)

  const filteredPricingConfigs = client.pricingConfigs
    .filter((pricingRow) => {
      const type = pricingRow.guardType?.toLowerCase() || ""
      const rate = String(pricingRow.rate)
      if (normalizedSearch && !type.includes(normalizedSearch) && !rate.includes(normalizedSearch)) return false
      if (selectDate && toIsoDate(pricingRow.updatedAt) !== selectDate) return false
      return true
    })
    .slice(0, showCount)

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

  // Build attachment data for the Attachments tab
  type AttachmentItem = { name: string; dataUrl: string }
  const parseAttachments = (raw: unknown): AttachmentItem[] => {
    if (!Array.isArray(raw)) return []
    return (raw as { name?: string; dataUrl?: string }[]).filter((a) => a?.dataUrl).map((a) => ({ name: a.name || "Attachment", dataUrl: a.dataUrl! }))
  }
  const clientAdditional = parseAttachments(client.contractAttachments)
  const totalClientDocs = (client.contractUrl ? 1 : 0) + clientAdditional.length + (client.logoUrl ? 1 : 0)
  const branchAttachments = client.branches.map((b) => ({
    branch: b,
    additional: parseAttachments(b.contractAttachments),
  }))
  const totalBranchDocs = branchAttachments.reduce((sum, { branch, additional }) => sum + (branch.contractUrl ? 1 : 0) + additional.length, 0)
  const totalDocs = totalClientDocs + totalBranchDocs
  const uploadedDocs = totalDocs // all stored = uploaded

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
                  <Image
                    src={client.logoUrl}
                    alt={client.name}
                    width={220}
                    height={192}
                    unoptimized
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
          <CardBody className="space-y-4">
            <LegacyFilterForm clientId={client.id} tab="assigned-guards">
              <FilterField label="Select Supervisor" name="supervisor" defaultValue={supervisor} />
              <FilterField label="Select Manager" name="manager" defaultValue={manager} />
              <FilterField label="Select Date" name="selectDate" type="date" defaultValue={selectDate} />
              <FilterField label="Show" name="show" as="select" defaultValue={show} options={["10", "25", "50", "100"]} />
              <FilterField label="Search:" name="search" defaultValue={listSearch} />
            </LegacyFilterForm>

            {filteredAssignedRows.length === 0 ? (
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
                  {filteredAssignedRows.map(({ deployment, branch }) => (
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
          <CardBody className="space-y-4">
            <LegacyFilterForm clientId={client.id} tab="extra-guards">
              <FilterField label="Branch*" name="branch" defaultValue={branch} />
              <FilterField label="Start Date" name="startDate" type="date" defaultValue={startDate} />
              <FilterField label="End Date" name="endDate" type="date" defaultValue={endDate} />
              <FilterField label="Show" name="show" as="select" defaultValue={show} options={["10", "25", "50", "100", "200"]} />
              <FilterField label="Search:" name="search" defaultValue={listSearch} />
            </LegacyFilterForm>

            {filteredExtraRows.length === 0 ? (
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
                  {filteredExtraRows.map(({ deployment, branch }) => (
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
          <CardBody className="space-y-4">
            <LegacyFilterForm clientId={client.id} tab="branches">
              <FilterField label="Show" name="show" as="select" defaultValue={show} options={["10", "25", "50", "100"]} />
              <FilterField label="Search:" name="search" defaultValue={listSearch} />
              <FilterField label="Select Date" name="selectDate" type="date" defaultValue={selectDate} />
            </LegacyFilterForm>

            {filteredBranches.length === 0 ? (
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
                  {filteredBranches.map((branch) => (
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
          <CardBody className="space-y-4">
            <LegacyFilterForm clientId={client.id} tab="pricing">
              <FilterField label="Show" name="show" as="select" defaultValue={show} options={["10", "25", "50", "100"]} />
              <FilterField label="Search:" name="search" defaultValue={listSearch} />
              <FilterField label="Select Date" name="selectDate" type="date" defaultValue={selectDate} />
            </LegacyFilterForm>

            {filteredPricingConfigs.length === 0 ? (
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
                  {filteredPricingConfigs.map((config) => (
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
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 py-3 text-center">
              <p className="text-2xl font-bold text-[var(--text)]">{totalDocs}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Total Files</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-green-200 bg-green-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-green-700">{uploadedDocs}</p>
              <p className="text-xs text-green-600 mt-0.5">Uploaded</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-center">
              <p className="text-2xl font-bold text-[var(--text-muted)]">{client.isBranchless ? "Branchless" : `${client.branches.length} Branch${client.branches.length !== 1 ? "es" : ""}`}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Client Type</p>
            </div>
          </div>

          {/* Client-level attachments */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--brand)]" />
              <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wide">Client Attachments — {client.name}</h2>
            </CardHeader>
            <CardBody>
              {totalClientDocs === 0 ? (
                <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--text-muted)]">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  No attachments uploaded for this client yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {client.logoUrl && (
                    <AttachmentRow name="Client Logo" type="Logo" source={client.name} uploadedAt={client.updatedAt} dataUrl={client.logoUrl} />
                  )}
                  {client.contractUrl && (
                    <AttachmentRow name="Client Contract" type="Contract" source={client.name} uploadedAt={client.updatedAt} dataUrl={client.contractUrl} />
                  )}
                  {clientAdditional.map((att, idx) => (
                    <AttachmentRow key={idx} name={att.name} type="Attachment" source={client.name} uploadedAt={client.updatedAt} dataUrl={att.dataUrl} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Branch-level attachments (branch clients only) */}
          {!client.isBranchless && (
            <>
              {branchAttachments.length === 0 ? (
                <Card>
                  <CardBody>
                    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--text-muted)]">
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      No branches found for this client.
                    </div>
                  </CardBody>
                </Card>
              ) : (
                branchAttachments.map(({ branch: b, additional }) => {
                  const branchTotal = (b.contractUrl ? 1 : 0) + additional.length
                  return (
                    <Card key={b.id}>
                      <CardHeader className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-[var(--text-muted)]" />
                        <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wide flex-1">{b.name}</h2>
                        {b.isHeadOffice && (
                          <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide">Head Office</span>
                        )}
                        <span className="text-xs text-[var(--text-muted)]">{branchTotal} file{branchTotal !== 1 ? "s" : ""}</span>
                      </CardHeader>
                      <CardBody>
                        {branchTotal === 0 ? (
                          <p className="text-sm text-[var(--text-muted)] italic">No attachments uploaded for this branch.</p>
                        ) : (
                          <div className="space-y-2">
                            {b.contractUrl && (
                              <AttachmentRow name="Branch Contract" type="Contract" source={b.name} uploadedAt={b.updatedAt} dataUrl={b.contractUrl} />
                            )}
                            {additional.map((att, idx) => (
                              <AttachmentRow key={idx} name={att.name} type="Attachment" source={b.name} uploadedAt={b.updatedAt} dataUrl={att.dataUrl} />
                            ))}
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  )
                })
              )}
            </>
          )}
        </div>
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FieldDisplay label="Effective Rate" value="35,000" />
              <FieldDisplay label="Guard Ex-Services" value="Other" />
              <FieldDisplay label="Extra Hours Rate / Hour" value="500" />
              <FieldDisplay label="Criteria" value="Branch-wise" />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="ui-btn ui-btn-secondary">Reset</button>
              <button type="button" className="ui-btn ui-btn-secondary">Submit</button>
              <button type="button" className="ui-btn ui-btn-secondary">Export In Excel File</button>
              <button type="button" className="ui-btn ui-btn-secondary">Dismiss</button>
              <button type="button" className="ui-btn ui-btn-primary">Save</button>
              <button type="button" className="ui-btn ui-btn-secondary">Close</button>
              <button type="button" className="ui-btn ui-btn-primary">Generate Invoice</button>
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
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">BRANCH MANAGER&apos;S INFORMATION</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FieldDisplay label="Manager *" value={primaryBranch?.contactPerson || "—"} />
                <FieldDisplay label="Manager Contact Number *" value={primaryBranch?.contactPhone || "—"} />
                <FieldDisplay label="NUMBER" value={primaryBranch?.contactPhone || "—"} />
                <FieldDisplay label="EMAIL" value={primaryBranch?.contactEmail || "—"} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">OPERATIONS MANAGER&apos;S INFORMATION</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FieldDisplay label="Manager *" value={primaryBranch?.contactPerson || "—"} />
                <FieldDisplay label="Manager Contact Number" value={primaryBranch?.contactPhone || "—"} />
                <FieldDisplay label="Select City" value={primaryBranch?.city || client.city || "—"} />
                <FieldDisplay label="EMAIL" value={primaryBranch?.contactEmail || "—"} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">SUPERVISOR&apos;S INFORMATION</h3>
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

function LegacyFilterForm({
  clientId,
  tab,
  children,
}: {
  clientId: string
  tab: TabKey
  children: ReactNode
}) {
  return (
    <form className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <input type="hidden" name="tab" value={tab} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">{children}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" formAction={`/clients/${clientId}`} className="ui-btn ui-btn-primary">Search</button>
        <Link href={`/clients/${clientId}?tab=${tab}`} className="ui-btn ui-btn-secondary">Reset</Link>
        <button type="button" className="ui-btn ui-btn-secondary">Export In Excel File</button>
      </div>
    </form>
  )
}

function AttachmentRow({
  name,
  type,
  source,
  uploadedAt,
  dataUrl,
}: {
  name: string
  type: "Contract" | "Logo" | "Attachment"
  source: string
  uploadedAt: Date
  dataUrl: string
}) {
  const badgeColor =
    type === "Contract" ? "bg-blue-100 text-blue-700" :
    type === "Logo" ? "bg-purple-100 text-purple-700" :
    "bg-gray-100 text-gray-600"

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
      <Paperclip className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
      <span className="flex-1 text-sm font-medium text-[var(--text)] truncate">{name}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${badgeColor}`}>{type}</span>
      <span className="text-xs text-[var(--text-muted)] flex-shrink-0 hidden sm:block">{source}</span>
      <span className="text-xs text-[var(--text-muted)] flex-shrink-0 hidden md:block">{formatDate(uploadedAt)}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        <a
          href={dataUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline"
        >
          View <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

function FilterField({
  label,
  name,
  defaultValue,
  type = "text",
  as,
  options = [],
}: {
  label: string
  name: string
  defaultValue?: string
  type?: "text" | "date"
  as?: "select"
  options?: string[]
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      {as === "select" ? (
        <select name={name} defaultValue={defaultValue || ""} className="ui-select">
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input name={name} type={type} defaultValue={defaultValue || ""} className="ui-input" />
      )}
    </label>
  )
}
