import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, internalServerError, unauthorized, forbidden, notFound } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import type { Prisma } from "@prisma/client"

function parseMonthStart(month: string) {
  const value = `${month}-01T00:00:00.000Z`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function nextMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

function generateInvoiceNumber() {
  const ts = Date.now().toString().slice(-8)
  return `INV-${ts}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId") || undefined
    const status = searchParams.get("status") || undefined
    const month = searchParams.get("month") || undefined
    const search = searchParams.get("search")?.trim()

    const where: Prisma.InvoiceWhereInput = {}
    if (clientId) where.clientId = clientId
    if (status) where.status = status.toUpperCase()

    if (month) {
      const start = parseMonthStart(month)
      if (start) {
        where.month = {
          gte: start,
          lt: nextMonth(start),
        }
      }
    }

    const clientScope = buildManagerScopeWhere(managerScope, { regionId: "regionId" })
    if (Object.keys(clientScope).length > 0) {
      where.client = { is: clientScope }
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { client: { is: { name: { contains: search, mode: "insensitive" } } } },
      ]
    }

    const rows = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            regionId: true,
          },
        },
      },
      take: 300,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return internalServerError("Failed to fetch invoices")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const clientId = body?.clientId ? String(body.clientId) : ""
    const monthValue = body?.month ? String(body.month) : ""
    const amount = Number(body?.amount)
    const dueDate = body?.dueDate ? new Date(body.dueDate) : null

    if (!clientId || !monthValue || !Number.isFinite(amount) || amount < 0) {
      return badRequest("clientId, month, and non-negative amount are required.")
    }

    const month = parseMonthStart(monthValue)
    if (!month) {
      return badRequest("month must be in YYYY-MM format.")
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, regionId: true },
    })
    if (!client) {
      return notFound("Client not found.")
    }

    if (managerScope && managerScopeDenied(managerScope, { regionId: client.regionId })) {
      return forbidden("Forbidden: cannot create invoice outside your scope.")
    }

    const invoice = await prisma.invoice.create({
      data: {
        clientId,
        invoiceNumber: generateInvoiceNumber(),
        month,
        amount,
        dueDate,
        status: (body?.status ? String(body.status) : "PENDING").toUpperCase(),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            regionId: true,
          },
        },
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error("Error creating invoice:", error)
    return internalServerError("Failed to create invoice")
  }
}
