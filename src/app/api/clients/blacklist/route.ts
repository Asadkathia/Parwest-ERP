import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import { clientInScope, clientScopeWhere } from "@/lib/clients/access"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "CLIENTS", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get("regionId")?.trim() || null

    // Branch-based scoping (B1): branchful clients scope by their branches'
    // regional office; branchless keep their own region. An optional ?regionId=
    // topbar filter narrows to that same branch-OR-branchless shape.
    const scopeWhere = clientScopeWhere(managerScope)
    const andClauses: Record<string, unknown>[] = []
    if (Object.keys(scopeWhere).length > 0) andClauses.push(scopeWhere)
    if (regionId) {
      andClauses.push({
        OR: [
          { branches: { some: { regionalOffice: { regionId } } } },
          { isBranchless: true, regionId },
        ],
      })
    }

    const where: Record<string, unknown> = { status: "BLACKLISTED" }
    if (andClauses.length > 0) where.AND = andClauses

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
    if (!hasAction(session, "CLIENTS", "CREATE")) return forbidden("Access denied.")
    // Blacklisting is a global-only action (region-less clients have no single
    // owning region) — restrict the mutation to SuperAdmins.
    if (!isSuperAdmin(session)) return forbidden("Forbidden: blacklisting is restricted to administrators.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const email = body?.email ? String(body.email).trim().toLowerCase() : ""
    const clientId = body?.clientId ? String(body.clientId) : ""

    let target = null as null | { id: string }
    if (clientId) {
      target = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true },
      })
    } else if (email) {
      target = await prisma.client.findFirst({
        where: { email },
        select: { id: true },
      })
    }

    if (!target) {
      return notFound("Client not found.")
    }

    if (!(await clientInScope(target.id, managerScope))) {
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
    if (!hasAction(session, "CLIENTS", "DELETE")) return forbidden("Access denied.")
    // Un-blacklisting mirrors blacklisting: global-only, SuperAdmin-restricted.
    if (!isSuperAdmin(session)) return forbidden("Forbidden: blacklisting is restricted to administrators.")
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return badRequest("id is required.")
    }

    const existing = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      return notFound("Client not found.")
    }
    if (!(await clientInScope(existing.id, managerScope))) {
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
