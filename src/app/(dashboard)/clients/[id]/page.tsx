import { type ReactNode } from "react"
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { hasAction } from "@/lib/api/permissions"
import Image from "next/image"
import { prisma } from "@/lib/db"
import PricingManager from "@/components/clients/PricingManager"
import ClientStatusToggle from "@/components/clients/ClientStatusToggle"
import Link from "next/link"
import { ArrowLeft, Edit, FileText, Plus, Paperclip, Building2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import { Button } from "@/components/shadcn/button"
import { Badge } from "@/components/shadcn/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table"
import { TabStatusBadge } from "@/components/guards/tabs/status-badge"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
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
    guardStatus?: string
  }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreateClient = hasAction(session, "CLIENTS", "CREATE")
  const canUpdateClient = hasAction(session, "CLIENTS", "UPDATE")
  const inventoryAssignmentHref = "/store-inventory/inventory-assignments"

  const { id } = await params
  const {
    tab: tabParam,
    search: listSearch = "",
    show = "10",
    selectDate = "",
    branch = "",
    startDate = "",
    endDate = "",
    guardStatus = "All",
  } = await searchParams
  const activeTab: TabKey = isTab(tabParam) ? tabParam : "general-information"
  const showCount = toSafeNumber(show, 10)

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      region: true,
      regionalOffice: { select: { id: true, name: true } },
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
      deployments: {
        include: { guard: true, branch: true },
        orderBy: { deploymentDate: "desc" },
      },
      supervisorAssignments: {
        where: { status: "ACTIVE" },
        include: { supervisor: { select: { name: true, email: true } } },
        take: 1,
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

  const managerScope = deriveManagerScope(session)
  if (managerScope && managerScopeDenied(managerScope, { regionId: client.regionId, regionalOfficeId: client.regionalOfficeId })) {
    notFound()
  }

  // Resolve assigned manager name (stored as plain ID, no relation)
  const assignedManager = client.assignedManagerId
    ? await prisma.user.findUnique({
        where: { id: client.assignedManagerId },
        select: { name: true, email: true },
      }).catch(() => null)
    : null

  const allDeployments = client.branches.flatMap((branch) =>
    (branch.deployments || []).map((deployment) => ({ branch, deployment }))
  )

  const activeDeploymentRows = allDeployments.filter((row) => row.deployment.status === "ACTIVE")
  // Treat both the legacy `isExtraGuard` boolean and the new
  // `deploymentType === "EXTRA"` value as "extra" (Ticket 34 — boolean
  // deprecated, type is the source of truth).
  const extraDeploymentRows = activeDeploymentRows.filter(
    (row) => row.deployment.isExtraGuard || row.deployment.deploymentType === "EXTRA"
  )

  const normalizedSearch = listSearch.trim().toLowerCase()
  const normalizedBranch = branch.trim().toLowerCase()

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

  // ── Full deployment history (all statuses, from client.deployments directly) ──
  const guardStatusLower = guardStatus.toLowerCase()
  const deploymentHistory = (client.deployments || [])
    .filter((d) => {
      if (guardStatusLower === "active") return d.status === "ACTIVE"
      if (guardStatusLower === "previous") return d.status !== "ACTIVE"
      return true
    })
    .filter((d) => {
      const guardName = d.guard?.name?.toLowerCase() || ""
      const guardParwest = d.guard?.parwestId?.toLowerCase() || ""
      const branchName = (d.branch?.name || "").toLowerCase()
      if (normalizedSearch && !guardName.includes(normalizedSearch) && !guardParwest.includes(normalizedSearch) && !branchName.includes(normalizedSearch)) return false
      if (selectDate && toIsoDate(d.deploymentDate) !== selectDate) return false
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
      <div className="mb-4 flex items-start justify-between gap-4 flex items-center gap-2"><div><h2 className="text-xl font-bold tracking-tight">{(`${client.name} - PROFILE V2`)}</h2><p className="mt-1 text-sm text-muted-foreground">{"Legacy-aligned client profile view"}</p></div><div className="flex shrink-0 items-center gap-2">{(<div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/clients">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            {!client.isBranchless && canCreateClient && (
              <Button asChild variant="outline">
                <Link href={`/clients/${client.id}/branches/new`}>
                  <Plus className="h-4 w-4" />
                  Add Branch
                </Link>
              </Button>
            )}
            {canUpdateClient ? <ClientStatusToggle clientId={client.id} currentStatus={client.status} /> : null}
            {canUpdateClient ? (
              <Button asChild>
                <Link href={`/clients/${client.id}/edit`}>
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            ) : null}
          </div>)}</div></div>

      <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab
          return (
            <Button
              key={tab.key}
              asChild
              variant={isActive ? "default" : "outline"}
              size="sm"
            >
              <Link href={`/clients/${client.id}?tab=${tab.key}`}>
                {tab.label}
              </Link>
            </Button>
          )
        })}
      </div>

      {activeTab === "general-information" ? (
        <div className="space-y-4">
          {/* ── Profile header card ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">General Information</CardTitle>
              {canUpdateClient ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/clients/${client.id}/edit`}>
                    <Edit className="h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo + quick metrics */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
                <div className="space-y-3">
                  {client.logoUrl ? (
                    <Image
                      src={client.logoUrl}
                      alt={client.name}
                      width={200}
                      height={176}
                      unoptimized
                      className="h-44 w-full rounded-md border object-cover"
                    />
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                      PHOTO NOT AVAILABLE
                    </div>
                  )}
                  <Button type="button" size="sm" className="w-full">Upload Picture</Button>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  <InfoCell label="BRANCHES" value={String(client.branches.length)} />
                  <InfoCell label="DAY DUTY GUARDS" value={String(uniqueDayGuardIds.size)} />
                  <InfoCell label="NIGHT DUTY GUARDS" value={String(uniqueNightGuardIds.size)} />
                  <InfoCell label="LOCATION SUPERVISORS" value={String(locationSupervisors)} />
                  <InfoCell label="CPO" value={String(cpoCount)} />
                  <InfoCell label="GUARD-LESS BRANCHES" value={String(guardLessBranches)} accent />
                  <InfoCell label="TOTAL ACTIVE GUARDS" value={String(uniqueDayGuardIds.size + uniqueNightGuardIds.size)} />
                  <InfoCell label="TOTAL DEPLOYMENTS" value={String(client.deployments?.length ?? 0)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Basic Details ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Client Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoCell label="NAME" value={client.name} />
                <InfoCell label="CLIENT TYPE" value={client.type} />
                <InfoCell label="EMAIL" value={client.email || "—"} />
                <InfoCell label="STATUS" value={client.status} accent={client.status === "ACTIVE"} />
                <InfoCell label="CITY" value={client.city || "—"} />
                <InfoCell label="POSTAL CODE" value={client.postalCode || "—"} />
                <InfoCell label="ENROLLMENT DATE" value={formatDate(client.enrollmentDate)} />
                <InfoCell label="REGION" value={client.region?.name || "—"} />
                <InfoCell label="REGIONAL OFFICE" value={(client as unknown as { regionalOffice?: { name: string } | null }).regionalOffice?.name || "—"} />
                <InfoCell label="ASSIGNED MANAGER" value={assignedManager?.name || assignedManager?.email || "—"} />
                <InfoCell label="BRANCHLESS CLIENT" value={client.isBranchless ? "Yes" : "No"} />
                <InfoCell label="HEAD OFFICE ADDRESS" value={client.headOfficeAddress || "—"} />
                <InfoCell label="OPERATIONAL PROVINCES" value={client.operationalProvinces || "—"} />
                <InfoCell label="NTN" value={client.ntn || "—"} />
                <InfoCell label="STRN" value={client.strn || "—"} />
              </div>
            </CardContent>
          </Card>

          {/* ── Contact Information ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoCell label="CONTACT PERSON" value={client.contactPerson || "—"} />
                <InfoCell label="CONTACT DESIGNATION" value={(client as unknown as { contactPersonDesignation?: string | null }).contactPersonDesignation || "—"} />
                <InfoCell label="PRIMARY PHONE" value={client.phone || "—"} />
                <InfoCell
                  label="ADDITIONAL NUMBERS"
                  value={
                    Array.isArray(client.contactNumbers) && (client.contactNumbers as string[]).length > 0
                      ? (client.contactNumbers as string[]).join(", ")
                      : "—"
                  }
                />
                <InfoCell label="ASSIGNED SUPERVISOR" value={client.supervisorAssignments?.[0]?.supervisor?.name || client.supervisorAssignments?.[0]?.supervisor?.email || "—"} />
              </div>
            </CardContent>
          </Card>

          {/* ── Introducer Information (conditional) ── */}
          {(client.introducerName || client.introducerContactNumber || client.introducerCnic) ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Introducer Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InfoCell label="INTRODUCER NAME" value={client.introducerName || "—"} />
                  <InfoCell label="CONTACT NUMBER" value={client.introducerContactNumber || "—"} />
                  <InfoCell label="CNIC" value={client.introducerCnic || "—"} />
                  <InfoCell label="ADDRESS" value={client.introducerAddress || "—"} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ── Guard Capacity (conditional) ── */}
          {(client.dayGuardCapacity != null || client.nightGuardCapacity != null || client.daySupervisorCapacity != null || client.nightSupervisorCapacity != null || client.cpoCapacity != null) ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Guard Capacity (Configured)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  <InfoCell label="DAY GUARDS" value={client.dayGuardCapacity != null ? String(client.dayGuardCapacity) : "—"} />
                  <InfoCell label="NIGHT GUARDS" value={client.nightGuardCapacity != null ? String(client.nightGuardCapacity) : "—"} />
                  <InfoCell label="DAY SUPERVISORS" value={client.daySupervisorCapacity != null ? String(client.daySupervisorCapacity) : "—"} />
                  <InfoCell label="NIGHT SUPERVISORS" value={client.nightSupervisorCapacity != null ? String(client.nightSupervisorCapacity) : "—"} />
                  <InfoCell label="CPO CAPACITY" value={client.cpoCapacity != null ? String(client.cpoCapacity) : "—"} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ── Contract Details (conditional) ── */}
          {(() => {
            const c = client as unknown as {
              contractDayGuardDesignation?: string | null
              contractDayGuardExService?: string | null
              contractNightGuardDesignation?: string | null
              contractNightGuardExService?: string | null
              contractAdditionalDayGuards?: number | null
              contractAdditionalNightGuards?: number | null
            }
            const hasContract = client.contractStart || client.contractEnd || client.contractPrice != null ||
              client.contractGuardDesignation || c.contractDayGuardDesignation || c.contractNightGuardDesignation
            if (!hasContract) return null
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Contract Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCell label="CONTRACT START" value={formatDate(client.contractStart)} />
                    <InfoCell label="CONTRACT END" value={formatDate(client.contractEnd)} />
                    <InfoCell label="RATE PERIOD START" value={formatDate(client.contractRateStart)} />
                    <InfoCell label="RATE PERIOD END" value={formatDate(client.contractRateEnd)} />
                    <InfoCell
                      label="CONTRACT PRICE"
                      value={client.contractPrice != null ? `PKR ${client.contractPrice.toLocaleString()}` : "—"}
                    />
                    <InfoCell label="DAY GUARD DESIGNATION" value={c.contractDayGuardDesignation || client.contractGuardDesignation || "—"} />
                    <InfoCell label="DAY GUARD EX-SERVICE" value={c.contractDayGuardExService || client.contractGuardExService || "—"} />
                    <InfoCell label="ADDITIONAL DAY GUARDS" value={c.contractAdditionalDayGuards != null ? String(c.contractAdditionalDayGuards) : (client.contractAdditionalGuards != null ? String(client.contractAdditionalGuards) : "—")} />
                    <InfoCell label="NIGHT GUARD DESIGNATION" value={c.contractNightGuardDesignation || "—"} />
                    <InfoCell label="NIGHT GUARD EX-SERVICE" value={c.contractNightGuardExService || "—"} />
                    <InfoCell label="ADDITIONAL NIGHT GUARDS" value={c.contractAdditionalNightGuards != null ? String(c.contractAdditionalNightGuards) : "—"} />
                  </div>
                </CardContent>
              </Card>
            )
          })()}
        </div>
      ) : null}

      {activeTab === "assigned-guards" ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Assigned Guards</CardTitle>
              <p className="text-xs text-muted-foreground">Full deployment history — current &amp; previous</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <TabStatusBadge
                label={`Active: ${(client.deployments || []).filter((d) => d.status === "ACTIVE").length}`}
                variant="success"
              />
              <TabStatusBadge
                label={`Previous: ${(client.deployments || []).filter((d) => d.status !== "ACTIVE").length}`}
                variant="muted"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <LegacyFilterForm clientId={client.id} tab="assigned-guards">
              <FilterField label="Status" name="guardStatus" as="select" defaultValue={guardStatus} options={["All", "Active", "Previous"]} />
              <FilterField label="Select Date" name="selectDate" type="date" defaultValue={selectDate} />
              <FilterField label="Show" name="show" as="select" defaultValue={show} options={["10", "25", "50", "100"]} />
              <FilterField label="Search:" name="search" defaultValue={listSearch} />
            </LegacyFilterForm>

            {deploymentHistory.length === 0 ? (
              <EmptyTableMessage message="No records found." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parwest ID</TableHead>
                      <TableHead>Guard Name</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Deployed On</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deploymentHistory.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono tabular-nums">{d.guard?.parwestId || "—"}</TableCell>
                        <TableCell className="font-medium">{d.guard?.name || "—"}</TableCell>
                        <TableCell>{d.branch?.name || "—"}</TableCell>
                        <TableCell>{normalizeDesignation(d.designation)}</TableCell>
                        <TableCell>{normalizeShift(d.shiftType)}</TableCell>
                        <TableCell className="tabular-nums">{formatDate(d.deploymentDate)}</TableCell>
                        <TableCell className="tabular-nums">{d.endDate ? formatDate(d.endDate) : "—"}</TableCell>
                        <TableCell>{d.deploymentType || "REGULAR"}</TableCell>
                        <TableCell>
                          <TabStatusBadge label={d.status} status={d.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "extra-guards" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extra Guards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LegacyFilterForm clientId={client.id} tab="extra-guards">
              <FilterField label="Branch*" name="branch" defaultValue={branch} />
              <FilterField label="Start Date" name="startDate" type="date" defaultValue={startDate} />
              <FilterField label="End Date" name="endDate" type="date" defaultValue={endDate} />
              <FilterField label="Show" name="show" as="select" defaultValue={show} options={["10", "25", "50", "100", "200"]} />
              <FilterField label="Search:" name="search" defaultValue={listSearch} />
            </LegacyFilterForm>

            {filteredExtraRows.length === 0 ? (
              <EmptyTableMessage message="No records found." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parwest ID</TableHead>
                      <TableHead>Guard Name</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Deployment Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExtraRows.map(({ deployment, branch }) => (
                      <TableRow key={deployment.id}>
                        <TableCell className="font-mono tabular-nums">{deployment.guard?.parwestId || "—"}</TableCell>
                        <TableCell className="font-medium">{deployment.guard?.name || "—"}</TableCell>
                        <TableCell>{branch.name}</TableCell>
                        <TableCell>{normalizeShift(deployment.shiftType)}</TableCell>
                        <TableCell className="tabular-nums">{formatDate(deployment.deploymentDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "branches" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Branches</CardTitle>
            {canCreateClient ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/clients/${client.id}/branches/new`}>
                  <Plus className="h-4 w-4" />
                  Add Branch
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <LegacyFilterForm clientId={client.id} tab="branches">
              <FilterField label="Show" name="show" as="select" defaultValue={show} options={["10", "25", "50", "100"]} />
              <FilterField label="Search:" name="search" defaultValue={listSearch} />
              <FilterField label="Select Date" name="selectDate" type="date" defaultValue={selectDate} />
            </LegacyFilterForm>

            {filteredBranches.length === 0 ? (
              <EmptyTableMessage message="No records found." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead className="text-right">Active Deployments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBranches.map((branch) => (
                      <TableRow key={branch.id}>
                        <TableCell className="font-medium">
                          <Link href={`/clients/branches/${branch.id}`} className="text-primary hover:underline">
                            {branch.name}
                          </Link>
                        </TableCell>
                        <TableCell>{branch.city || "—"}</TableCell>
                        <TableCell>{branch.address || "—"}</TableCell>
                        <TableCell>{branch.contactPerson || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(branch.deployments || []).filter((d) => d.status === "ACTIVE").length}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "pricing" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contracts &amp; Pricing Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <PricingManager
              clientId={client.id}
              clientName={client.name}
              branches={client.branches.map((b) => ({ id: b.id, name: b.name }))}
              isBranchless={client.isBranchless}
              operationalProvinces={client.operationalProvinces ?? null}
              regionName={client.region?.name ?? null}
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "attachments" ? (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="px-4 py-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{totalDocs}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Files</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900">
              <CardContent className="px-4 py-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{uploadedDocs}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">Uploaded</p>
              </CardContent>
            </Card>
            <Card className="bg-muted">
              <CardContent className="px-4 py-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground">
                  {client.isBranchless ? "Branchless" : `${client.branches.length} Branch${client.branches.length !== 1 ? "es" : ""}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Client Type</p>
              </CardContent>
            </Card>
          </div>

          {/* Client-level attachments */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm uppercase tracking-wide">Client Attachments — {client.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {totalClientDocs === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  No records found.
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
            </CardContent>
          </Card>

          {/* Branch-level attachments (branch clients only) */}
          {!client.isBranchless && (
            <>
              {branchAttachments.length === 0 ? (
                <Card>
                  <CardContent>
                    <div className="flex items-center gap-2 rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      No records found.
                    </div>
                  </CardContent>
                </Card>
              ) : (
                branchAttachments.map(({ branch: b, additional }) => {
                  const branchTotal = (b.contractUrl ? 1 : 0) + additional.length
                  return (
                    <Card key={b.id}>
                      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm uppercase tracking-wide flex-1">{b.name}</CardTitle>
                        {b.isHeadOffice && <Badge>Head Office</Badge>}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {branchTotal} file{branchTotal !== 1 ? "s" : ""}
                        </span>
                      </CardHeader>
                      <CardContent>
                        {branchTotal === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No records found.</p>
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
                      </CardContent>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Inventory</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={inventoryAssignmentHref}>Open Inventory Assignment</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {client.inventoryAssignments.length === 0 ? (
              <EmptyTableMessage message="No records found." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Unique No.</TableHead>
                      <TableHead>Assigned At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.inventoryAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">{assignment.item?.serialNumber || assignment.item?.uniqueNumber || "—"}</TableCell>
                        <TableCell>{assignment.item?.category?.name || "—"}</TableCell>
                        <TableCell className="font-mono tabular-nums">{assignment.item?.uniqueNumber || "—"}</TableCell>
                        <TableCell className="tabular-nums">{formatDate(assignment.assignedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "client-invoicing" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Client Invoicing</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/clients/invoicing">Open Invoicing Module</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Button type="button" variant="outline" size="sm">Reset</Button>
              <Button type="button" variant="outline" size="sm">Submit</Button>
              <Button type="button" variant="outline" size="sm">Export In Excel File</Button>
              <Button type="button" variant="outline" size="sm">Dismiss</Button>
              <Button type="button" size="sm">Save</Button>
              <Button type="button" variant="outline" size="sm">Close</Button>
              <Button type="button" size="sm">Generate Invoice</Button>
            </div>

            {client.invoices.length === 0 ? (
              <EmptyTableMessage message="No records found." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono tabular-nums">{invoice.invoiceNumber}</TableCell>
                        <TableCell className="tabular-nums">{formatDate(invoice.month)}</TableCell>
                        <TableCell className="text-right">
                          <ParwestCurrency value={invoice.amount} />
                        </TableCell>
                        <TableCell>
                          <TabStatusBadge label={invoice.status} status={invoice.status} />
                        </TableCell>
                        <TableCell className="tabular-nums">{formatDate(invoice.dueDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "contact-information" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Client Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FieldDisplay label="NAME" value={client.name} />
                <FieldDisplay label="EMAIL" value={client.email || "—"} />
                <FieldDisplay label="CONTACT PERSON" value={client.contactPerson || "—"} />
                <FieldDisplay label="PRIMARY PHONE" value={client.phone || "—"} />
                <FieldDisplay label="HEAD OFFICE ADDRESS" value={client.headOfficeAddress || "—"} />
                <FieldDisplay label="CITY" value={client.city || "—"} />
                <FieldDisplay label="POSTAL CODE" value={client.postalCode || "—"} />
                <FieldDisplay label="REGION" value={client.region?.name || "—"} />
              </div>
            </CardContent>
          </Card>

          {client.introducerName ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Introducer Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FieldDisplay label="INTRODUCER NAME" value={client.introducerName || "—"} />
                  <FieldDisplay label="CONTACT NUMBER" value={client.introducerContactNumber || "—"} />
                  <FieldDisplay label="CNIC" value={client.introducerCnic || "—"} />
                  <FieldDisplay label="ADDRESS" value={client.introducerAddress || "—"} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Branch Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              {client.branches.length === 0 ? (
                <EmptyTableMessage message="No records found." />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {client.branches.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.name}</TableCell>
                          <TableCell>{b.city || "—"}</TableCell>
                          <TableCell>{b.contactPerson || "—"}</TableCell>
                          <TableCell className="tabular-nums">{b.contactPhone || "—"}</TableCell>
                          <TableCell>{b.contactEmail || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Assigned Supervisor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FieldDisplay label="SUPERVISOR NAME" value={client.supervisorAssignments?.[0]?.supervisor?.name || "—"} />
                <FieldDisplay label="SUPERVISOR EMAIL" value={client.supervisorAssignments?.[0]?.supervisor?.email || "—"} />
                <FieldDisplay label="BRANCHLESS" value={client.isBranchless ? "Yes" : "No"} />
                <FieldDisplay label="OPERATIONAL PROVINCES" value={client.operationalProvinces || "—"} />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="pt-2">
        <TabStatusBadge label={client.status} status={client.status} />
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
    <div className="rounded-md border bg-muted p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={accent ? "mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300" : "mt-1 text-sm font-semibold"}>{value}</p>
    </div>
  )
}

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="rounded-md border bg-card px-3 py-2 text-sm">
        {value}
      </div>
    </div>
  )
}

function EmptyTableMessage({ message }: { message: string }) {
  return (
    <Card className="bg-muted">
      <CardContent className="px-4 py-8 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  )
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
    <form className="rounded-md border bg-muted p-3">
      <input type="hidden" name="tab" value={tab} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">{children}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" formAction={`/clients/${clientId}`} size="sm">Search</Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/clients/${clientId}?tab=${tab}`}>Reset</Link>
        </Button>
        <Button type="button" variant="outline" size="sm">Export In Excel File</Button>
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
  const badgeVariant: "default" | "secondary" | "outline" =
    type === "Contract" ? "default" : type === "Logo" ? "secondary" : "outline"

  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5">
      <Paperclip className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <span className="flex-1 text-sm font-medium truncate">{name}</span>
      <Badge variant={badgeVariant} className="flex-shrink-0">{type}</Badge>
      <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">{source}</span>
      <span className="text-xs text-muted-foreground flex-shrink-0 hidden md:block tabular-nums">{formatDate(uploadedAt)}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        <a
          href={dataUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
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
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {as === "select" ? (
        <select
          name={name}
          defaultValue={defaultValue || ""}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue || ""}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      )}
    </label>
  )
}
