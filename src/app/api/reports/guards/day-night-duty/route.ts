import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import { csvDownload, parseDateParam, parseReportFormat, toCsv } from "@/lib/reports/utils"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const managerScope = deriveManagerScope(session)

    const url = new URL(request.url)
    const format = parseReportFormat(url.searchParams.get("format"))
    const dateFrom = parseDateParam(url.searchParams.get("dateFrom"))
    const dateTo = parseDateParam(url.searchParams.get("dateTo"))
    const regionalOfficeId = url.searchParams.get("regionalOfficeId") || undefined
    const clientType = url.searchParams.get("clientType") || undefined
    const clientId = url.searchParams.get("clientId") || undefined
    const reportType = (url.searchParams.get("reportType") || "BOTH").toUpperCase()

    if (url.searchParams.get("dateFrom") && !dateFrom) return badRequest("Invalid dateFrom value.")
    if (url.searchParams.get("dateTo") && !dateTo) return badRequest("Invalid dateTo value.")
    if (!["DAY", "NIGHT", "BOTH"].includes(reportType)) return badRequest("reportType must be DAY, NIGHT, or BOTH.")
    if (
      managerScope &&
      managerScopeDenied(managerScope, { regionalOfficeId: regionalOfficeId || null })
    ) {
      return forbidden("Forbidden: report scope is outside your assignment.")
    }

    const shiftWhere =
      reportType === "BOTH"
        ? { in: ["DAY", "NIGHT", "BOTH"] as string[] }
        : reportType === "DAY"
          ? { in: ["DAY", "BOTH"] as string[] }
          : { in: ["NIGHT", "BOTH"] as string[] }

    const deployments = await prisma.deployment.findMany({
      where: {
        shiftType: shiftWhere,
        ...(dateFrom || dateTo
          ? {
              deploymentDate: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
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
      dutyType: deployment.shiftType,
      regionalOffice: deployment.regionalOffice?.name || "",
      client: deployment.client.name,
      clientType: deployment.client.type,
      branch: deployment.branch?.name || "",
      parwestId: deployment.guard.parwestId,
      guardName: deployment.guard.name,
      status: deployment.status,
    }))

    if (format === "csv") {
      const csv = toCsv(rows, [
        { key: "deploymentId", label: "Deployment ID" },
        { key: "deploymentDate", label: "Deployment Date" },
        { key: "dutyType", label: "Duty Type" },
        { key: "regionalOffice", label: "Regional Office" },
        { key: "client", label: "Client" },
        { key: "clientType", label: "Client Type" },
        { key: "branch", label: "Branch" },
        { key: "parwestId", label: "Parwest ID" },
        { key: "guardName", label: "Guard Name" },
        { key: "status", label: "Status" },
      ])
      return csvDownload("day-night-duty-report.csv", csv)
    }

    const summary = {
      total: rows.length,
      day: rows.filter((row) => row.dutyType === "DAY").length,
      night: rows.filter((row) => row.dutyType === "NIGHT").length,
      both: rows.filter((row) => row.dutyType === "BOTH").length,
      active: rows.filter((row) => row.status === "ACTIVE").length,
    }

    return ok({
      report: "guards.day-night-duty",
      filters: { dateFrom: dateFrom?.toISOString() || null, dateTo: dateTo?.toISOString() || null, regionalOfficeId: regionalOfficeId || null, clientType: clientType || null, clientId: clientId || null, reportType },
      summary,
      rows,
    })
  } catch (error) {
    console.error("Error generating day-night-duty report:", error)
    return internalServerError("Failed to generate day-night-duty report.")
  }
}
