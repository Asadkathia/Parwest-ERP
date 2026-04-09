import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const regionId = searchParams.get("regionId") || undefined
    const regionalOfficeId = searchParams.get("regionalOfficeId") || undefined
    const clientId = searchParams.get("clientId") || undefined
    const status = searchParams.get("status") || undefined

    const where: Record<string, unknown> = {}
    if (clientId) where.clientId = clientId
    if (status) where.status = status

    // Filter by region/regionalOffice via client relation
    const clientWhere: Record<string, unknown> = {}
    if (regionId) clientWhere.regionId = regionId
    if (regionalOfficeId) clientWhere.regionalOfficeId = regionalOfficeId

    const insurances = await (prisma.clientInsurance as unknown as {
      findMany: (args: unknown) => Promise<unknown[]>
    }).findMany({
      where: {
        ...where,
        ...(Object.keys(clientWhere).length > 0 ? { client: clientWhere } : {}),
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
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(insurances)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const body = await request.json()
    const clientId = String(body?.clientId || "").trim()
    const insuranceName = String(body?.insuranceName || "").trim()
    const status = String(body?.status || "ACTIVE").trim()
    const startDate = body?.startDate ? new Date(body.startDate) : undefined
    const endDate = body?.endDate ? new Date(body.endDate) : undefined

    if (!clientId) return badRequest("Client is required.")
    if (!insuranceName) return badRequest("Insurance name is required.")

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

    // Audit log
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
