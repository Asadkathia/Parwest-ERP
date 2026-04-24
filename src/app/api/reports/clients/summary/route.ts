import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { csvDownload, parseMonthRange, parseReportFormat, toCsv } from "@/lib/reports/utils"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "REPORTS", "VIEW")) return forbidden()

    const managerScope = deriveManagerScope(session)
    const url = new URL(request.url)

    const format = parseReportFormat(url.searchParams.get("format"))
    const month = parseMonthRange(url.searchParams.get("month"))
    const regionId = url.searchParams.get("regionId") || undefined
    const clientType = url.searchParams.get("clientType") || undefined
    const clientId = url.searchParams.get("clientId") || undefined

    if (url.searchParams.get("month") && !month) return badRequest("Invalid month value. Use YYYY-MM.")
    if (managerScope && managerScopeDenied(managerScope, { regionId: regionId || null })) {
      return forbidden("Forbidden: report scope is outside your assignment.")
    }

    const clients = await prisma.client.findMany({
      where: {
        ...(regionId ? { regionId } : {}),
        ...(clientType ? { type: clientType } : {}),
        ...(clientId ? { id: clientId } : {}),
        ...(managerScope?.regionId ? { regionId: managerScope.regionId } : {}),
      },
      include: {
        region: { select: { name: true } },
        branches: { select: { id: true } },
      },
      take: 2000,
      orderBy: { name: "asc" },
    })

    const targetClientIds = clients.map((client) => client.id)
    const deployments = targetClientIds.length
      ? await prisma.deployment.findMany({
          where: {
            clientId: { in: targetClientIds },
            ...(month
              ? {
                  deploymentDate: {
                    gte: month.start,
                    lt: month.end,
                  },
                }
              : {}),
          },
          select: {
            clientId: true,
            shiftType: true,
            status: true,
            guardId: true,
          },
        })
      : []

    const invoices = targetClientIds.length
      ? await prisma.invoice.findMany({
          where: {
            clientId: { in: targetClientIds },
            ...(month
              ? {
                  month: {
                    gte: month.start,
                    lt: month.end,
                  },
                }
              : {}),
          },
          select: {
            clientId: true,
            amount: true,
            status: true,
          },
        })
      : []

    const rows = clients.map((client) => {
      const clientDeployments = deployments.filter((deployment) => deployment.clientId === client.id)
      const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id)

      return {
        clientId: client.id,
        clientName: client.name,
        type: client.type,
        status: client.status,
        region: client.region?.name || "",
        branches: client.branches.length,
        activeDeployments: clientDeployments.filter((deployment) => deployment.status === "ACTIVE").length,
        dayDeployments: clientDeployments.filter((deployment) => deployment.shiftType === "DAY").length,
        nightDeployments: clientDeployments.filter((deployment) => deployment.shiftType === "NIGHT").length,
        bothShiftDeployments: clientDeployments.filter((deployment) => deployment.shiftType === "BOTH").length,
        deployedGuards: new Set(clientDeployments.map((deployment) => deployment.guardId)).size,
        invoices: clientInvoices.length,
        paidInvoices: clientInvoices.filter((invoice) => invoice.status === "PAID").length,
        pendingInvoices: clientInvoices.filter((invoice) => invoice.status !== "PAID").length,
        invoiceAmount: Number(clientInvoices.reduce((sum, invoice) => sum + invoice.amount, 0).toFixed(2)),
      }
    })

    if (format === "csv") {
      const csv = toCsv(rows, [
        { key: "clientId", label: "Client ID" },
        { key: "clientName", label: "Client Name" },
        { key: "type", label: "Client Type" },
        { key: "status", label: "Status" },
        { key: "region", label: "Region" },
        { key: "branches", label: "Branches" },
        { key: "activeDeployments", label: "Active Deployments" },
        { key: "dayDeployments", label: "Day Deployments" },
        { key: "nightDeployments", label: "Night Deployments" },
        { key: "bothShiftDeployments", label: "Both Shift Deployments" },
        { key: "deployedGuards", label: "Deployed Guards" },
        { key: "invoices", label: "Invoices" },
        { key: "paidInvoices", label: "Paid Invoices" },
        { key: "pendingInvoices", label: "Pending Invoices" },
        { key: "invoiceAmount", label: "Invoice Amount" },
      ])
      return csvDownload("client-summary-report.csv", csv)
    }

    const summary = {
      totalClients: rows.length,
      activeClients: rows.filter((row) => row.status === "ACTIVE").length,
      totalBranches: rows.reduce((sum, row) => sum + row.branches, 0),
      totalDeployments: rows.reduce((sum, row) => sum + row.activeDeployments, 0),
      totalDeployedGuards: rows.reduce((sum, row) => sum + row.deployedGuards, 0),
      totalInvoiceAmount: Number(rows.reduce((sum, row) => sum + row.invoiceAmount, 0).toFixed(2)),
    }

    return ok({
      report: "clients.summary",
      filters: {
        month: url.searchParams.get("month") || null,
        regionId: regionId || null,
        clientType: clientType || null,
        clientId: clientId || null,
      },
      summary,
      rows,
    })
  } catch (error) {
    console.error("Error generating client summary report:", error)
    return internalServerError("Failed to generate client summary report.")
  }
}
