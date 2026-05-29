/**
 * POST /api/deductions/advance-salary
 *
 * Issue an advance salary to a guard and generate the recovery schedule.
 *
 * Body:
 *   {
 *     guardId, principal, issuedOn, reason?,
 *     // either:
 *     installmentAmount + installmentCount,
 *     // or:
 *     schedule: [{ payrollMonth, amount }]
 *   }
 *
 * Sum of schedule rows must equal `principal` (within Rs 1 rounding).
 *
 * Gated by:
 *   - DEDUCTIONS:CREATE permission
 *   - workflow rule deductions.advanceSalaryAutoRecover (off → records the
 *     advance but skips schedule generation; recovery is manual)
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

type ScheduleInput = { payrollMonth: string; amount: number }

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "DEDUCTIONS", "CREATE")) {
      return forbidden("Access denied")
    }

    const body = (await request.json()) as Record<string, unknown>
    const guardId = typeof body.guardId === "string" ? body.guardId : null
    const principal = typeof body.principal === "number" ? body.principal : null
    const issuedOnRaw = typeof body.issuedOn === "string" ? body.issuedOn : null
    const reason = typeof body.reason === "string" ? body.reason : null
    const installmentAmount =
      typeof body.installmentAmount === "number" ? body.installmentAmount : null
    const installmentCount =
      typeof body.installmentCount === "number" ? body.installmentCount : null
    const explicitSchedule = Array.isArray(body.schedule)
      ? (body.schedule as ScheduleInput[])
      : null

    if (!guardId || principal === null || !issuedOnRaw) {
      return badRequest("guardId, principal, issuedOn required")
    }
    if (principal <= 0) return badRequest("principal must be positive")
    const issuedOn = new Date(issuedOnRaw)
    if (Number.isNaN(issuedOn.getTime())) return badRequest("invalid issuedOn")

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true },
    })
    if (!guard) return notFound("Guard not found")

    // Decide schedule
    let scheduleRows: { payrollMonth: Date; amount: number }[] = []
    if (explicitSchedule && explicitSchedule.length > 0) {
      for (const s of explicitSchedule) {
        const d = new Date(s.payrollMonth)
        if (Number.isNaN(d.getTime()) || typeof s.amount !== "number" || s.amount <= 0) {
          return badRequest("schedule rows must have payrollMonth + positive amount")
        }
        scheduleRows.push({ payrollMonth: d, amount: s.amount })
      }
      const sum = scheduleRows.reduce((a, r) => a + r.amount, 0)
      if (Math.abs(sum - principal) > 1) {
        return badRequest(
          `schedule sum ${sum.toFixed(2)} does not match principal ${principal.toFixed(2)}`
        )
      }
    } else if (installmentAmount && installmentCount) {
      scheduleRows = buildInstallmentSchedule({
        issuedOn,
        totalCost: principal,
        installmentAmount,
        installmentCount,
      })
    } else {
      return badRequest("Provide either installmentAmount+installmentCount or schedule[]")
    }

    const issuer = (session.user as { id?: string; name?: string }) ?? {}

    const result = await prisma.$transaction(async (trx) => {
      // Idempotency precheck — natural key: (guardId, issuedOn, principal).
      // AdvanceSalary has no plan/course reference; the same guard receiving
      // the same principal amount on the same date is overwhelmingly likely
      // to be a retried submission rather than a genuine second advance.
      // A retried POST must return the existing advance, not spawn a parallel
      // recovery schedule that double-charges the guard.
      // TODO(hardening): replace with @@unique([guardId, issuedOn, principal])
      // on AdvanceSalary per audit "Top #4 — Non-idempotent issuance triggers"
      // (docs/audits/deductions-pipeline-dead-legacy-conflict-audit.md).
      const existing = await trx.advanceSalary.findFirst({
        where: { guardId, issuedOn, principal },
      })
      if (existing) {
        return existing
      }

      const advance = await trx.advanceSalary.create({
        data: {
          guardId,
          principal,
          issuedOn,
          reason,
          status: "ACTIVE",
          issuedById: issuer.id ?? null,
          issuedByName: issuer.name ?? null,
        },
      })
      if (isWorkflowRuleEnabled("deductions.advanceSalaryAutoRecover")) {
        await trx.advanceSalaryRecovery.createMany({
          data: scheduleRows.map((r) => ({
            advanceSalaryId: advance.id,
            guardId,
            payrollMonth: r.payrollMonth,
            amount: r.amount,
            status: "PENDING",
          })),
        })
      }
      return advance
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return ok(result, 201)
  } catch (err) {
    console.error("[advance-salary]", err)
    return internalServerError("Failed to issue advance salary")
  }
}
