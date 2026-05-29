import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { requireGuardInScope } from "@/lib/guards/access"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

    const { id: guardId } = await context.params

    const insurances = await prisma.guardInsurance.findMany({
      where: { guardId },
      include: {
        clientInsurance: {
          include: {
            client: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(insurances)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "CREATE")) return forbidden("Access denied.")

    const { id: guardId } = await context.params

    const denied = await requireGuardInScope(session, guardId)
    if (denied) return denied

    const body = await request.json()
    const clientInsuranceId = String(body?.clientInsuranceId || "").trim()
    const healthId = String(body?.healthId || "").trim()

    if (!clientInsuranceId) return badRequest("Client insurance is required.")

    // Verify guard exists and get parwestId
    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, parwestId: true, name: true },
    })
    if (!guard) return badRequest("Guard not found.")

    const assignment = await prisma.guardInsurance.create({
      data: {
        guardId,
        clientInsuranceId,
        healthId: healthId || null,
        status: "ACTIVE",
        createdById: session.user?.id,
      },
      include: {
        clientInsurance: {
          include: { client: { select: { id: true, name: true } } },
        },
        createdBy: { select: { id: true, name: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "GUARD_INSURANCE_ASSIGNED",
        module: "GUARDS",
        description: `Insurance assigned to guard ${guard.parwestId} (${guard.name}). Health ID: "${healthId || "N/A"}". By ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (err: unknown) {
    console.error("Error assigning guard insurance:", err)
    return internalServerError("Failed to assign insurance.")
  }
}
