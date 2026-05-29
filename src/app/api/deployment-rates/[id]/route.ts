import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, notFound, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "UPDATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.deploymentRate.findUnique({ where: { id }, select: { regionId: true } })
    if (!existing) return notFound("Deployment rate not found")
    // Block edits to out-of-scope rows, and block moving a row to an out-of-scope region.
    if (
      managerScopeDenied(managerScope, { regionId: existing.regionId || undefined }) ||
      managerScopeDenied(managerScope, { regionId: body.regionId || undefined })
    ) {
      return forbidden("Forbidden: region is outside your scope.")
    }

    const updated = await prisma.deploymentRate.update({
      where: { id },
      data: {
        regionId: body.regionId || undefined,
        clientId: body.clientId || undefined,
        branchId: body.branchId || undefined,
        deployAs: body.deployAs || undefined,
        guardType: body.guardType || undefined,
        shiftType: body.shiftType || undefined,
        salary: body.salary != null ? Number(body.salary) : undefined,
        overtime: body.overtime != null ? Number(body.overtime) : undefined,
        extraHours: body.extraHours != null ? Number(body.extraHours) : undefined,
        postAllowance: body.postAllowance != null ? Number(body.postAllowance) : undefined,
      },
      include: {
        region: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    return ok(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Deployment rate not found")
    console.error("Error updating deployment rate:", error)
    return internalServerError("Failed to update deployment rate")
  }
}
