import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

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
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
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

    const steps: { step: string; ok: boolean; count?: number; message?: string }[] = []

    // Step 1: Revoke active deployment(s)
    const deployResult = await prisma.deployment.updateMany({
      where: { guardId, status: "ACTIVE" },
      data: {
        status: "INACTIVE",
        endDate: now,
        endReason: "CLEARANCE",
        revokedByName: userName,
      },
    })
    steps.push({ step: "Revoke Deployment", ok: true, count: deployResult.count })

    // Step 2: Revoke inventory assignments
    const invResult = await prisma.storeInventoryAssignment.updateMany({
      where: { assignedToGuardId: guardId, status: "ASSIGNED" },
      data: {
        status: "RETURNED",
        returnedAt: now,
        returnedByUserId: session.user?.id ?? null,
      },
    })
    steps.push({ step: "Revoke Inventory", ok: true, count: invResult.count })

    // Step 3: Return pledged documents
    const pledgeResult = await prisma.guardPledgedDocumentRecord.updateMany({
      where: { guardId, status: "HELD" },
      data: {
        status: "RETURNED",
        returnedAt: now,
        returnedBy: userName,
        returnType: "CLEARANCE",
      },
    })
    steps.push({ step: "Return Pledged Documents", ok: true, count: pledgeResult.count })

    // Step 4: Mark guard INACTIVE + record payroll clearance row
    await prisma.guard.update({
      where: { id: guardId },
      data: { status: "INACTIVE" },
    })
    // Upsert a payroll row marked as clearance settlement
    await prisma.payroll.upsert({
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
    steps.push({ step: "Clearance Done", ok: true, message: `Slip ${slipNumber}` })

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
