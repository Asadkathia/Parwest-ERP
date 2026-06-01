import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { normalizeStatusColor } from "@/lib/guards/statusColors"

// Admin-managed reference catalog of guard status labels (display/lookup only).
// Does NOT drive the canonical guard lifecycle state machine. See ticket #58.
// Defaults are seeded by the migration (not on read), so an admin who deletes a
// status keeps it deleted rather than having it resurrected on the next GET.

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "VIEW")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })
    const activeOnly = request.nextUrl.searchParams.get("activeOnly") !== "false"
    const statuses = await prisma.guardStatusOption.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    return NextResponse.json(statuses)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "CREATE")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const body = await request.json()
    const name = String(body?.name || "").trim()
    if (!name) return badRequest("Name is required.")
    const color = normalizeStatusColor(body?.color)

    const status = await prisma.guardStatusOption.create({
      data: { name, color, isActive: true, sortOrder: Number(body?.sortOrder ?? 0) },
    })
    return NextResponse.json(status, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return badRequest("A status with this name already exists.")
    }
    return internalServerError("Failed to create guard status.")
  }
}
