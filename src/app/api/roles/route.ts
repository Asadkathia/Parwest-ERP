import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, conflict, forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

function parseScopeType(value: unknown): "GLOBAL" | "REGIONAL" | null {
  if (value === "GLOBAL" || value === "REGIONAL") return value
  return null
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    if (!hasAction(session, "USERS", "VIEW")) return forbidden("Access denied.")

    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
    })

    // TODO(consumer-unwrap): roles list is consumed by RolesManager / UserTypesManager / role pickers as raw array.
    return NextResponse.json(roles)
  } catch (error) {
    console.error("Error fetching roles:", error)
    return internalServerError("Failed to fetch roles")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    if (!hasAction(session, "USERS", "CREATE")) return forbidden("Access denied.")

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const description = body?.description ? String(body.description) : null
    const scopeType = parseScopeType(body?.scopeType) ?? "REGIONAL"

    if (!name) {
      return badRequest("Role name is required.")
    }

    const role = await prisma.role.create({
      data: { name, description, scopeType },
    })

    return ok(role, 201)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2002") {
      return conflict("Role name already exists.")
    }
    console.error("Error creating role:", error)
    return internalServerError("Failed to create role")
  }
}
