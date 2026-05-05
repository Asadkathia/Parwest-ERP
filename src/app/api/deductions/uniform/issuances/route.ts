/**
 * POST /api/deductions/uniform/issuances
 *
 * Issue a jersey to a guard. Snapshots the active UniformPlan and spawns N
 * UniformInstallment rows starting the month after issuance.
 *
 * Idempotent on (guardId, issuedOn) within the same UniformPlan version.
 *
 * Gated by:
 *   - DEDUCTIONS:CREATE permission (any DEDUCTIONS user with CREATE)
 *   - workflow rule deductions.uniformAutoInstallments (off → still records
 *     the issuance row for audit, but skips installment spawn)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  badRequest,
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import { buildInstallmentSchedule } from "@/lib/deductions/installments"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "DEDUCTIONS", "CREATE")) {
      return forbidden("Access denied")
    }

    const body = (await request.json()) as Record<string, unknown>
    const guardId = typeof body.guardId === "string" ? body.guardId : null
    const issuedOnRaw = typeof body.issuedOn === "string" ? body.issuedOn : null
    const notes = typeof body.notes === "string" ? body.notes : null
    if (!guardId || !issuedOnRaw) return badRequest("guardId and issuedOn required")
    const issuedOn = new Date(issuedOnRaw)
    if (Number.isNaN(issuedOn.getTime())) return badRequest("invalid issuedOn")

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true },
    })
    if (!guard) return notFound("Guard not found")

    // Resolve active uniform plan
    const planRows = await prisma.uniformPlan.findMany({
      where: { status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
    })
    const ms = issuedOn.getTime()
    const plan = planRows.find(
      (r) =>
        r.effectiveFrom.getTime() <= ms &&
        (r.effectiveTo === null || r.effectiveTo.getTime() > ms)
    )
    if (!plan) {
      return badRequest(
        "MISSING_RATE: no active UniformPlan covers the issuance date"
      )
    }

    const issuer = (session.user as { id?: string; name?: string }) ?? {}

    const result = await prisma.$transaction(async (trx) => {
      const issuance = await trx.uniformIssuance.create({
        data: {
          guardId,
          uniformPlanId: plan.id,
          issuedOn,
          totalCost: plan.totalCost,
          installmentAmount: plan.installmentAmount,
          installmentCount: plan.installmentCount,
          status: "ACTIVE",
          notes,
          issuedById: issuer.id ?? null,
          issuedByName: issuer.name ?? null,
        },
      })

      if (isWorkflowRuleEnabled("deductions.uniformAutoInstallments")) {
        const schedule = buildInstallmentSchedule({
          issuedOn,
          totalCost: plan.totalCost,
          installmentAmount: plan.installmentAmount,
          installmentCount: plan.installmentCount,
        })
        if (schedule.length > 0) {
          await trx.uniformInstallment.createMany({
            data: schedule.map((s) => ({
              uniformIssuanceId: issuance.id,
              guardId,
              payrollMonth: s.payrollMonth,
              amount: s.amount,
              status: "PENDING",
            })),
          })
        }
      }

      return issuance
    })

    return ok(result, 201)
  } catch (err) {
    console.error("[uniform/issuances]", err)
    return internalServerError("Failed to issue uniform")
  }
}
