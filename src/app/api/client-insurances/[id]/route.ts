import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { deriveManagerScope } from "@/lib/access/scope"
import { clientInScope } from "@/lib/clients/access"
import type { Session } from "next-auth"

async function resolveScope(id: string, session: Session) {
  const managerScope = deriveManagerScope(session)
  if (!managerScope) return null

  // Branch-aware (B1): scope by the client relation, not its (NULL for branchful)
  // regionId — managerScopeDenied(client.regionId) would FAIL OPEN. Fetch the
  // insurance's clientId and delegate to the branch-based clientInScope SoT.
  const insurance = await (prisma.clientInsurance as unknown as {
    findUnique: (args: unknown) => Promise<{ clientId: string } | null>
  }).findUnique({
    where: { id },
    select: { clientId: true },
  })

  if (!insurance) return "not_found"
  if (!(await clientInScope(insurance.clientId, managerScope))) return "forbidden"

  return null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await context.params
    const scopeResult = await resolveScope(id, session)
    if (scopeResult === "not_found") return notFound("Insurance not found.")
    if (scopeResult === "forbidden") return forbidden("Access denied: client is outside your scope.")

    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.insuranceName !== undefined) {
      const name = String(body.insuranceName || "").trim()
      if (!name) return badRequest("Insurance name is required.")
      data.insuranceName = name
    }
    if (body.status !== undefined) data.status = String(body.status)
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null

    if (Object.keys(data).length === 0) return badRequest("No fields provided.")

    const updated = await (prisma.clientInsurance as unknown as {
      update: (args: unknown) => Promise<unknown>
    }).update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "CLIENT_INSURANCE_UPDATED",
        module: "CLIENTS",
        description: `Insurance ${id} updated by ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Insurance not found.")
    console.error("Error updating client insurance:", error)
    return internalServerError("Failed to update insurance.")
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await context.params
    const scopeResult = await resolveScope(id, session)
    if (scopeResult === "not_found") return notFound("Insurance not found.")
    if (scopeResult === "forbidden") return forbidden("Access denied: client is outside your scope.")

    await (prisma.clientInsurance as unknown as {
      delete: (args: unknown) => Promise<unknown>
    }).delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "CLIENT_INSURANCE_DELETED",
        module: "CLIENTS",
        description: `Insurance ${id} deleted by ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Insurance not found.")
    console.error("Error deleting client insurance:", error)
    return internalServerError("Failed to delete insurance.")
  }
}
