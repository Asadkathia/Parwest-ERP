import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { clientInScope, clientScopeWhere } from "@/lib/clients/access"

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

    // Branch-based scoping (B1): branchful clients are region-less, so scope by
    // their branches' regional office; branchless clients keep their own region.
    // `managerScopeDenied({regionId: client.regionId})` would FAIL OPEN on a NULL
    // branchful regionId — so go through clientScopeWhere instead. Optional
    // ?regionId=/?regionalOfficeId= topbar filters narrow within the same shape.
    const andClauses: Prisma.ClientWhereInput[] = []
    const scopeWhere = clientScopeWhere(managerScope)
    if (Object.keys(scopeWhere).length > 0) andClauses.push(scopeWhere)
    if (regionalOfficeId) {
      andClauses.push({
        OR: [
          { branches: { some: { regionalOfficeId } } },
          { isBranchless: true, regionalOfficeId },
        ],
      })
    } else if (regionId) {
      andClauses.push({
        OR: [
          { branches: { some: { regionalOffice: { regionId } } } },
          { isBranchless: true, regionId },
        ],
      })
    }
    where.client = andClauses.length ? { AND: andClauses } : undefined

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

    // Scope check: verify the target client is within the manager's scope.
    // Branch-aware (B1) — region-less branchful clients would FAIL OPEN under
    // managerScopeDenied(client.regionId), so gate via clientInScope.
    if (managerScope) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true },
      })
      if (!client) return notFound("Client not found.")
      if (!(await clientInScope(clientId, managerScope))) {
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
