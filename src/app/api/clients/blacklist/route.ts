import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "CLIENTS")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const where: Record<string, unknown> = { status: "BLACKLISTED" }
    Object.assign(where, buildManagerScopeWhere(managerScope, { regionId: "regionId" }))

    const rows = await prisma.client.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        status: true,
        updatedAt: true,
        regionId: true,
      },
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching blacklisted clients:", error)
    return internalServerError("Failed to fetch blacklisted clients")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "CLIENTS")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const email = body?.email ? String(body.email).trim().toLowerCase() : ""
    const clientId = body?.clientId ? String(body.clientId) : ""

    let target = null as null | { id: string; regionId: string | null }
    if (clientId) {
      target = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, regionId: true },
      })
    } else if (email) {
      target = await prisma.client.findFirst({
        where: { email },
        select: { id: true, regionId: true },
      })
    }

    if (!target) {
      return notFound("Client not found.")
    }

    if (managerScope && managerScopeDenied(managerScope, { regionId: target.regionId })) {
      return forbidden("Forbidden: client is outside your scope.")
    }

    const updated = await prisma.client.update({
      where: { id: target.id },
      data: { status: "BLACKLISTED" },
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        status: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    console.error("Error blacklisting client:", error)
    return internalServerError("Failed to blacklist client")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "CLIENTS")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return badRequest("id is required.")
    }

    const existing = await prisma.client.findUnique({
      where: { id },
      select: { id: true, regionId: true },
    })
    if (!existing) {
      return notFound("Client not found.")
    }
    if (managerScope && managerScopeDenied(managerScope, { regionId: existing.regionId })) {
      return forbidden("Forbidden: client is outside your scope.")
    }

    const updated = await prisma.client.update({
      where: { id },
      data: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        status: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error removing blacklist client:", error)
    return internalServerError("Failed to remove blacklist client")
  }
}
