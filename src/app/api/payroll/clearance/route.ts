import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { applyTransition } from "@/lib/guards/lifecycle"

/**
 * Clearance = reverse cycle for deployment.
 * Steps performed atomically:
 *   1. Revoke active Deployment (endDate + endReason = "CLEARANCE")
 *   2. Revoke Inventory — mark all ACTIVE StoreInventoryAssignment for guard as RETURNED
 *   3. Return Pledged Documents — mark all HELD GuardPledgedDocumentRecord as RETURNED
 *   4. Mark guard status = "INACTIVE", record final payroll settlement
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const scope = deriveManagerScope(session)

    const body = await request.json()
    const guardId = String(body.guardId || "")
    const monthInput = String(body.month || "")
    const otherDeduction = Number(body.otherDeduction || 0)
    const paymentDate = body.paymentDate ? new Date(String(body.paymentDate)) : null
    const slipNumber = body.slipNumber ? String(body.slipNumber) : null

    if (!guardId || !monthInput || !paymentDate || !slipNumber) {
      return badRequest("guardId, month, paymentDate, slipNumber are required.")
    }

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, name: true, status: true, regionId: true, regionalOfficeId: true },
    })
    if (!guard) return notFound("Guard not found.")
    if (scope && managerScopeDenied(scope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
      return forbidden("Forbidden: guard is outside your scope.")
    }

    const userName =
      (session.user as { name?: string })?.name ?? (session.user as { email?: string })?.email ?? "unknown"
    const now = new Date()
    const monthNormalized = /^\d{4}-\d{2}$/.test(monthInput) ? `${monthInput}-01` : monthInput
    const month = new Date(monthNormalized)

    const { deployResult, invResult, pledgeResult } = await prisma.$transaction(async (tx) => {
      // Step 1: Revoke active deployment(s)
      const deployResult = await tx.deployment.updateMany({
        where: { guardId, status: "ACTIVE" },
        data: {
          status: "INACTIVE",
          endDate: now,
          endReason: "CLEARANCE",
          revokedByName: userName,
        },
      })

      // Step 2: Revoke inventory assignments
      const invResult = await tx.storeInventoryAssignment.updateMany({
        where: { assignedToGuardId: guardId, status: "ASSIGNED" },
        data: {
          status: "RETURNED",
          returnedAt: now,
          returnedByUserId: session.user?.id ?? null,
        },
      })

      // Step 3: Return pledged documents
      const pledgeResult = await tx.guardPledgedDocumentRecord.updateMany({
        where: { guardId, status: "HELD" },
        data: {
          status: "RETURNED",
          returnedAt: now,
          returnedBy: userName,
          returnType: "CLEARANCE",
        },
      })

      // Step 4: Transition guard → INACTIVE via the lifecycle state machine.
      // Skip the transition if the guard is already in a non-ACTIVE state (e.g.
      // re-running clearance). `revokeDeployments: false` because step 1 above
      // already revoked them inside this transaction.
      const guardSnap = await tx.guard.findUnique({
        where: { id: guardId },
        select: { lifecycleStatus: true },
      })
      if (guardSnap && guardSnap.lifecycleStatus === "ACTIVE") {
        await applyTransition(tx, {
          guardId,
          to: "INACTIVE",
          ctx: {
            actorId: session.user?.id ?? null,
            actorName: userName,
            reason: "Payroll clearance settlement",
            trigger: "SYSTEM",
          },
          revokeDeployments: false,
        })
      }

      // Upsert a payroll row marked as clearance settlement
      await tx.payroll.upsert({
        where: {
          guardId_month_year: {
            guardId,
            month,
            year: month.getUTCFullYear(),
          },
        },
        create: {
          guardId,
          month,
          year: month.getUTCFullYear(),
          otherDeductions: otherDeduction,
          paymentStatus: "PAID",
          paymentMethod: "CASH",
        },
        update: {
          otherDeductions: otherDeduction,
          paymentStatus: "PAID",
        },
      })

      return { deployResult, invResult, pledgeResult }
    })

    const steps: { step: string; ok: boolean; count?: number; message?: string }[] = [
      { step: "Revoke Deployment", ok: true, count: deployResult.count },
      { step: "Revoke Inventory", ok: true, count: invResult.count },
      { step: "Return Pledged Documents", ok: true, count: pledgeResult.count },
      { step: "Clearance Done", ok: true, message: `Slip ${slipNumber}` },
    ]

    // Audit log
    await prisma.auditLog
      .create({
        data: {
          userId: session.user?.id ?? "system",
          event: "GUARD_CLEARANCE",
          module: "PAYROLL",
          description: `Clearance completed for ${guard.name}. Deployment revoked: ${deployResult.count}, inventory returned: ${invResult.count}, pledged docs returned: ${pledgeResult.count}. Slip: ${slipNumber}. By ${userName}.`,
        },
      })
      .catch(() => {})

    return NextResponse.json({ success: true, guardId, steps })
  } catch (error) {
    console.error("Error initiating clearance:", error)
    return internalServerError("Failed to initiate clearance.")
  }
}
