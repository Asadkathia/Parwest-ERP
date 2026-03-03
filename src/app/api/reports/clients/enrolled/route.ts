import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { csvDownload, parseDateParam, parseReportFormat, toCsv } from "@/lib/reports/utils"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const managerScope = deriveManagerScope(session)
    const url = new URL(request.url)

    const format = parseReportFormat(url.searchParams.get("format"))
    const startDate = parseDateParam(url.searchParams.get("startDate"))
    const endDate = parseDateParam(url.searchParams.get("endDate"))
    const regionId = url.searchParams.get("regionId") || undefined
    const clientType = url.searchParams.get("clientType") || undefined
    const status = url.searchParams.get("status") || undefined

    if (url.searchParams.get("startDate") && !startDate) return badRequest("Invalid startDate value.")
    if (url.searchParams.get("endDate") && !endDate) return badRequest("Invalid endDate value.")
    if (managerScope && managerScopeDenied(managerScope, { regionId: regionId || null })) {
      return forbidden("Forbidden: report scope is outside your assignment.")
    }

    const clients = await prisma.client.findMany({
      where: {
        ...(startDate || endDate
          ? {
              enrollmentDate: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
        ...(regionId ? { regionId } : {}),
        ...(clientType ? { type: clientType } : {}),
        ...(status ? { status } : {}),
        ...(managerScope?.regionId ? { regionId: managerScope.regionId } : {}),
      },
      include: {
        region: { select: { name: true } },
        branches: { select: { id: true, isHeadOffice: true } },
      },
      orderBy: { enrollmentDate: "desc" },
      take: 3000,
    })

    const clientIds = clients.map((client) => client.id)
    const deployments = clientIds.length
      ? await prisma.deployment.findMany({
          where: { clientId: { in: clientIds } },
          select: { clientId: true, status: true },
        })
      : []

    const invoices = clientIds.length
      ? await prisma.invoice.findMany({
          where: { clientId: { in: clientIds } },
          select: { clientId: true },
        })
      : []

    const rows = clients.map((client) => ({
      // mock-mode client rows may not include enrollmentDate, so fall back to createdAt
      enrollmentDate: (
        client.enrollmentDate ||
        client.createdAt ||
        new Date(0)
      ).toISOString(),
      clientId: client.id,
      clientName: client.name,
      type: client.type,
      status: client.status,
      region: client.region?.name || "",
      branchCount: client.branches.length,
      headOfficeBranches: client.branches.filter((branch) => branch.isHeadOffice).length,
      activeDeployments: deployments.filter(
        (deployment) => deployment.clientId === client.id && deployment.status === "ACTIVE"
      ).length,
      invoicesCount: invoices.filter((invoice) => invoice.clientId === client.id).length,
    }))

    if (format === "csv") {
      const csv = toCsv(rows, [
        { key: "clientId", label: "Client ID" },
        { key: "clientName", label: "Client Name" },
        { key: "type", label: "Client Type" },
        { key: "status", label: "Status" },
        { key: "enrollmentDate", label: "Enrollment Date" },
        { key: "region", label: "Region" },
        { key: "branchCount", label: "Branch Count" },
        { key: "headOfficeBranches", label: "Head Office Branches" },
        { key: "activeDeployments", label: "Deployments" },
        { key: "invoicesCount", label: "Invoices" },
      ])
      return csvDownload("client-enrolled-report.csv", csv)
    }

    const summary = {
      total: rows.length,
      active: rows.filter((row) => row.status === "ACTIVE").length,
      inactive: rows.filter((row) => row.status !== "ACTIVE").length,
      totalBranches: rows.reduce((sum, row) => sum + row.branchCount, 0),
      totalDeployments: rows.reduce((sum, row) => sum + row.activeDeployments, 0),
    }

    return ok({
      report: "clients.enrolled",
      filters: {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
        regionId: regionId || null,
        clientType: clientType || null,
        status: status || null,
      },
      summary,
      rows,
    })
  } catch (error) {
    console.error("Error generating client enrolled report:", error)
    return internalServerError("Failed to generate client enrolled report.")
  }
}
