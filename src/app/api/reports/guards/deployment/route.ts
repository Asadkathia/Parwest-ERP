import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { csvDownload, parseDateParam, parseReportFormat, toCsv } from "@/lib/reports/utils"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "REPORTS", "VIEW")) return forbidden()
    const managerScope = deriveManagerScope(session)

    const url = new URL(request.url)
    const format = parseReportFormat(url.searchParams.get("format"))
    const startDate = parseDateParam(url.searchParams.get("startDate"))
    const endDate = parseDateParam(url.searchParams.get("endDate"))
    const regionalOfficeId = url.searchParams.get("regionalOfficeId") || undefined
    const clientId = url.searchParams.get("clientId") || undefined
    const clientType = url.searchParams.get("clientType") || undefined

    if (url.searchParams.get("startDate") && !startDate) return badRequest("Invalid startDate value.")
    if (url.searchParams.get("endDate") && !endDate) return badRequest("Invalid endDate value.")
    if (
      managerScope &&
      managerScopeDenied(managerScope, { regionalOfficeId: regionalOfficeId || null })
    ) {
      return forbidden("Forbidden: report scope is outside your assignment.")
    }

    const deployments = await prisma.deployment.findMany({
      where: {
        ...(startDate || endDate
          ? {
              deploymentDate: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
        ...(regionalOfficeId ? { regionalOfficeId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(clientType ? { client: { is: { type: clientType } } } : {}),
        ...(managerScope?.regionalOfficeIds.length
          ? { regionalOfficeId: { in: managerScope.regionalOfficeIds } }
          : {}),
      },
      include: {
        guard: { select: { parwestId: true, name: true } },
        client: { select: { name: true, type: true } },
        branch: { select: { name: true } },
        regionalOffice: { select: { name: true } },
      },
      orderBy: { deploymentDate: "desc" },
      take: 2000,
    })

    const rows = deployments.map((deployment) => ({
      deploymentId: deployment.id,
      deploymentDate: deployment.deploymentDate.toISOString(),
      status: deployment.status,
      shiftType: deployment.shiftType,
      regionalOffice: deployment.regionalOffice?.name || "",
      client: deployment.client.name,
      clientType: deployment.client.type,
      branch: deployment.branch?.name || "",
      parwestId: deployment.guard.parwestId,
      guardName: deployment.guard.name,
      designation: deployment.designation,
    }))

    if (format === "csv") {
      const csv = toCsv(rows, [
        { key: "deploymentId", label: "Deployment ID" },
        { key: "deploymentDate", label: "Deployment Date" },
        { key: "status", label: "Status" },
        { key: "shiftType", label: "Shift Type" },
        { key: "regionalOffice", label: "Regional Office" },
        { key: "client", label: "Client" },
        { key: "clientType", label: "Client Type" },
        { key: "branch", label: "Branch" },
        { key: "parwestId", label: "Parwest ID" },
        { key: "guardName", label: "Guard Name" },
        { key: "designation", label: "Designation" },
      ])
      return csvDownload("guard-deployment-report.csv", csv)
    }

    const summary = {
      total: rows.length,
      active: rows.filter((row) => row.status === "ACTIVE").length,
      inactive: rows.filter((row) => row.status !== "ACTIVE").length,
      day: rows.filter((row) => row.shiftType === "DAY").length,
      night: rows.filter((row) => row.shiftType === "NIGHT").length,
      both: rows.filter((row) => row.shiftType === "BOTH").length,
    }

    return ok({
      report: "guards.deployment",
      filters: { startDate: startDate?.toISOString() || null, endDate: endDate?.toISOString() || null, regionalOfficeId: regionalOfficeId || null, clientId: clientId || null, clientType: clientType || null },
      summary,
      rows,
    })
  } catch (error) {
    console.error("Error generating guard deployment report:", error)
    return internalServerError("Failed to generate guard deployment report.")
  }
}
