import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const managerScope = deriveManagerScope(session)
    const { searchParams } = request.nextUrl
    const clientId = searchParams.get("clientId") || undefined
    const status = searchParams.get("status") || undefined
    const regionId = searchParams.get("regionId")
    const regionalOfficeId = searchParams.get("regionalOfficeId")

    if (managerScopeDenied(managerScope, { regionId, regionalOfficeId })) {
      return forbidden("Forbidden: requested scope is outside your assigned region.")
    }

    const where: Record<string, unknown> = {}
    if (clientId) where.clientId = clientId
    if (status) where.status = status

    // Apply manager scope via client relation
    const scopeWhere = managerScope
      ? buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" })
      : {}
    const clientFilter = {
      ...(regionId ? { regionId } : {}),
      ...(regionalOfficeId ? { regionalOfficeId } : {}),
      ...scopeWhere,
    }
    if (Object.keys(clientFilter).length > 0) {
      where.client = clientFilter
    }

    const insurances = await (prisma.clientInsurance as unknown as {
      findMany: (args: unknown) => Promise<unknown[]>
    }).findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            regionalOffice: { select: { id: true, name: true } },
            region: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(insurances)
  } catch {
    return internalServerError("Failed to fetch insurances.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const managerScope = deriveManagerScope(session)
    const body = await request.json()
    const clientId = String(body?.clientId || "").trim()
    const insuranceName = String(body?.insuranceName || "").trim()
    const status = String(body?.status || "ACTIVE").trim()
    const startDate = body?.startDate ? new Date(body.startDate) : undefined
    const endDate = body?.endDate ? new Date(body.endDate) : undefined

    if (!clientId) return badRequest("Client is required.")
    if (!insuranceName) return badRequest("Insurance name is required.")

    // Scope check: verify the target client is within the manager's scope
    if (managerScope) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { regionId: true, regionalOfficeId: true },
      })
      if (!client) return notFound("Client not found.")
      const { managerScopeDenied } = await import("@/lib/access/scope")
      if (managerScopeDenied(managerScope, { regionId: client.regionId, regionalOfficeId: client.regionalOfficeId })) {
        return forbidden("Access denied: client is outside your scope.")
      }
    }

    const insurance = await (prisma.clientInsurance as unknown as {
      create: (args: unknown) => Promise<unknown>
    }).create({
      data: {
        clientId,
        insuranceName,
        status,
        startDate,
        endDate,
        createdById: session.user?.id,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            regionalOffice: { select: { id: true, name: true } },
            region: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "CLIENT_INSURANCE_CREATED",
        module: "CLIENTS",
        description: `Insurance "${insuranceName}" created for client ${clientId} by ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json(insurance, { status: 201 })
  } catch (err: unknown) {
    console.error("Error creating client insurance:", err)
    return internalServerError("Failed to create insurance.")
  }
}
