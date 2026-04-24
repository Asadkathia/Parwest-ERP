import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

// GET - return the singleton age config (creates default if missing)
export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "ADMIN_APPROVALS", "VIEW")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    let config = await prisma.guardAgeConfig.findFirst()
    if (!config) {
      config = await prisma.guardAgeConfig.create({ data: { minAge: 18, maxAge: 45 } })
    }
    return NextResponse.json(config)
  } catch (error) {
    console.error("GET /api/guard-age-config:", error)
    return internalServerError("Failed to fetch age config")
  }
}

// PATCH - update min/max age
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "ADMIN_APPROVALS", "UPDATE")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const body = await request.json()
    const minAge = parseInt(String(body.minAge ?? ""))
    const maxAge = parseInt(String(body.maxAge ?? ""))

    if (!Number.isFinite(minAge) || minAge < 1) return badRequest("minAge must be a positive number")
    if (!Number.isFinite(maxAge) || maxAge < 1) return badRequest("maxAge must be a positive number")
    if (minAge >= maxAge) return badRequest("minAge must be less than maxAge")

    let config = await prisma.guardAgeConfig.findFirst()
    if (!config) {
      config = await prisma.guardAgeConfig.create({ data: { minAge, maxAge } })
    } else {
      config = await prisma.guardAgeConfig.update({ where: { id: config.id }, data: { minAge, maxAge } })
    }
    return NextResponse.json(config)
  } catch (error) {
    console.error("PATCH /api/guard-age-config:", error)
    return internalServerError("Failed to update age config")
  }
}
