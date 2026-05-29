/**
 * POST /api/deductions/training-school-fees/issuances
 *
 * Issue a course tuition cost to a guard. Spawns N TrainingSchoolFeeInstallment
 * rows starting the month after issuance.
 *
 * Unlike Uniform, the tuition plan is per-issuance (not from a global plan
 * table) — totalCost / installmentAmount / installmentCount are inputs.
 *
 * Gated by:
 *   - DEDUCTIONS:CREATE permission
 *   - workflow rule deductions.trainingSchoolFeesAutoInstallments
 */

import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
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
    const courseName = typeof body.courseName === "string" ? body.courseName : null
    const issuedOnRaw = typeof body.issuedOn === "string" ? body.issuedOn : null
    const totalCost = typeof body.totalCost === "number" ? body.totalCost : null
    const installmentAmount =
      typeof body.installmentAmount === "number" ? body.installmentAmount : null
    const installmentCount =
      typeof body.installmentCount === "number" ? body.installmentCount : null
    const notes = typeof body.notes === "string" ? body.notes : null

    if (
      !guardId ||
      !courseName ||
      !issuedOnRaw ||
      totalCost === null ||
      installmentAmount === null ||
      installmentCount === null
    ) {
      return badRequest(
        "guardId, courseName, issuedOn, totalCost, installmentAmount, installmentCount required"
      )
    }
    if (totalCost <= 0 || installmentAmount <= 0 || installmentCount <= 0) {
      return badRequest("amounts and count must be positive")
    }
    const issuedOn = new Date(issuedOnRaw)
    if (Number.isNaN(issuedOn.getTime())) return badRequest("invalid issuedOn")

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true },
    })
    if (!guard) return notFound("Guard not found")

    const issuer = (session.user as { id?: string; name?: string }) ?? {}

    const result = await prisma.$transaction(async (trx) => {
      // Idempotency precheck — natural key: (guardId, issuedOn, courseName).
      // TrainingSchoolFeeIssuance has no plan reference; courseName is the
      // closest tuition identifier that distinguishes one course issuance
      // from another for the same guard on the same date. A retried POST
      // for the same triple must return the existing issuance, not spawn
      // a parallel installment schedule.
      // TODO(hardening): replace with @@unique([guardId, issuedOn, courseName])
      // on TrainingSchoolFeeIssuance per audit "Top #4 — Non-idempotent
      // issuance triggers" (docs/audits/deductions-pipeline-dead-legacy-conflict-audit.md).
      const existing = await trx.trainingSchoolFeeIssuance.findFirst({
        where: { guardId, issuedOn, courseName },
      })
      if (existing) {
        return existing
      }

      const issuance = await trx.trainingSchoolFeeIssuance.create({
        data: {
          guardId,
          courseName,
          issuedOn,
          totalCost,
          installmentAmount,
          installmentCount,
          status: "ACTIVE",
          notes,
          issuedById: issuer.id ?? null,
          issuedByName: issuer.name ?? null,
        },
      })

      if (isWorkflowRuleEnabled("deductions.trainingSchoolFeesAutoInstallments")) {
        const schedule = buildInstallmentSchedule({
          issuedOn,
          totalCost,
          installmentAmount,
          installmentCount,
        })
        if (schedule.length > 0) {
          await trx.trainingSchoolFeeInstallment.createMany({
            data: schedule.map((s) => ({
              issuanceId: issuance.id,
              guardId,
              payrollMonth: s.payrollMonth,
              amount: s.amount,
              status: "PENDING",
            })),
          })
        }
      }

      return issuance
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return ok(result, 201)
  } catch (err) {
    console.error("[training-school-fees/issuances]", err)
    return internalServerError("Failed to issue training fee")
  }
}
