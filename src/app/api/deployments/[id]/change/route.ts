import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

/**
 * POST /api/deployments/[id]/change
 *
 * "Change Deployment" — ends the current deployment and creates a new one
 * with updated details (client, branch, shift, designation, nature, etc.).
 *
 * Body:
 *   effectiveDate  string (YYYY-MM-DD) — when the change takes effect
 *   changeReason   string              — reason for the change
 *   clientId       string
 *   branchId       string | null
 *   regionalOfficeId string
 *   shiftType      "DAY" | "NIGHT"
 *   designation    string
 *   deploymentType "REGULAR" | "OVERTIME"
 *   deploymentNature "PERMANENT" | "TEMPORARY"
 *   guardType      string?
 *   dayShiftStart  string?
 *   dayShiftEnd    string?
 *   nightShiftStart string?
 *   nightShiftEnd  string?
 *   isExtraGuard   boolean
 *   comment        string?
 *   notes          string?
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "GUARDS")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id } = await params
    const body = await request.json()

    // Validate current deployment
    const current = await prisma.deployment.findUnique({
      where: { id },
      include: {
        guard: { select: { id: true, name: true, parwestId: true, regionalOfficeId: true } },
        client: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    })
    if (!current) return notFound("Deployment not found")
    if (current.status === "INACTIVE") return badRequest("Cannot change an already inactive deployment.")
    if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: current.regionalOfficeId })) {
      return forbidden("Forbidden: deployment is outside your scope.")
    }

    // Parse effective date
    const effectiveDateRaw = String(body?.effectiveDate || "").trim()
    if (!effectiveDateRaw) return badRequest("effectiveDate is required.")
    const effectiveDate = new Date(effectiveDateRaw)
    if (Number.isNaN(effectiveDate.getTime())) return badRequest("Invalid effectiveDate.")
    effectiveDate.setHours(0, 0, 0, 0)

    const deploymentDate = new Date(current.deploymentDate)
    deploymentDate.setHours(0, 0, 0, 0)
    if (effectiveDate < deploymentDate) {
      return badRequest("Effective date cannot be before original deployment date.")
    }

    // New deployment fields
    const newClientId = String(body?.clientId || "").trim()
    const newBranchId = body?.branchId ? String(body.branchId).trim() : null
    const newRegionalOfficeId = String(body?.regionalOfficeId || current.regionalOfficeId).trim()
    const newShiftType = String(body?.shiftType || current.shiftType).toUpperCase()
    const newDesignation = String(body?.designation || current.designation || "Guard").trim()

    if (!newClientId) return badRequest("clientId is required.")
    if (!["DAY", "NIGHT", "BOTH"].includes(newShiftType)) return badRequest("Invalid shiftType.")

    // Validate new client/branch/office exist
    const [newClient, newOffice] = await Promise.all([
      prisma.client.findUnique({ where: { id: newClientId }, select: { id: true, name: true } }),
      prisma.regionalOffice.findUnique({ where: { id: newRegionalOfficeId }, select: { id: true } }),
    ])
    if (!newClient) return notFound("New client not found.")
    if (!newOffice) return notFound("Regional office not found.")
    if (newBranchId) {
      const branch = await prisma.branch.findUnique({ where: { id: newBranchId }, select: { id: true, clientId: true } })
      if (!branch) return notFound("Branch not found.")
      if (branch.clientId !== newClientId) return badRequest("Branch does not belong to the selected client.")
    }

    const userName = (session.user as { name?: string })?.name ?? "System"
    const changeReason = String(body?.changeReason || "").trim()

    // Run in a transaction: end current + create new
    const result = await prisma.$transaction(async (tx) => {
      // 1. End current deployment
      const ended = await tx.deployment.update({
        where: { id },
        data: {
          status: "INACTIVE",
          endDate: effectiveDate,
          endReason: changeReason ? `[CHANGE] ${changeReason}` : "[CHANGE] Deployment changed",
          revokedByName: userName,
        },
      })

      // 2. Create new deployment
      const created = await tx.deployment.create({
        data: {
          guardId: current.guardId,
          clientId: newClientId,
          branchId: newBranchId,
          regionalOfficeId: newRegionalOfficeId,
          designation: newDesignation,
          deploymentDate: effectiveDate,
          shiftType: newShiftType,
          status: "ACTIVE",
          guardType: body?.guardType ? String(body.guardType) : current.guardType,
          deploymentType: body?.deploymentType ? String(body.deploymentType) : (current.deploymentType ?? "REGULAR"),
          deploymentNature: body?.deploymentNature ? String(body.deploymentNature) : (current.deploymentNature ?? "PERMANENT"),
          isExtraGuard: body?.isExtraGuard === true || body?.isExtraGuard === "on",
          dayShiftStart: body?.dayShiftStart ? String(body.dayShiftStart) : null,
          dayShiftEnd: body?.dayShiftEnd ? String(body.dayShiftEnd) : null,
          nightShiftStart: body?.nightShiftStart ? String(body.nightShiftStart) : null,
          nightShiftEnd: body?.nightShiftEnd ? String(body.nightShiftEnd) : null,
          comment: body?.comment ? String(body.comment) : null,
          notes: body?.notes ? String(body.notes) : null,
          deployedByName: userName,
        },
        include: {
          guard: true,
          client: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          regionalOffice: true,
        },
      })

      return { ended, created }
    })

    return NextResponse.json(
      {
        message: "Deployment changed successfully",
        previousDeploymentId: result.ended.id,
        newDeployment: result.created,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("[POST /api/deployments/[id]/change] failed:", error)
    return internalServerError("Failed to change deployment")
  }
}