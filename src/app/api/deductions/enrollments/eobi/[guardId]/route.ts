/**
 * GET  /api/deductions/enrollments/eobi/[guardId] → current enrollment or null
 * PUT  /api/deductions/enrollments/eobi/[guardId] → upsert enrollment
 *
 * Gated by DEDUCTIONS:VIEW for GET and DEDUCTIONS:UPDATE for PUT.
 */

import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  badRequest,
  forbidden,
  internalServerError,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { upsertEobiEnrollment } from "@/lib/deductions/enrollments"
import { requireGuardInScope } from "@/lib/guards/access"

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ guardId: string }> }
) {
  try {
    const session = (await auth()) as Session | null
    if (!session) return unauthorized()
    if (!hasAction(session, "DEDUCTIONS", "VIEW")) return forbidden("Access denied")
    const { guardId } = await ctx.params
    // Regional scope: a regional Admin restricted to Region A must not be
    // able to read EOBI enrollment for a guard in Region B by ID.
    const denied = await requireGuardInScope(session, guardId)
    if (denied) return denied
    const row = await prisma.eobiEnrollment.findUnique({ where: { guardId } })
    return ok(row)
  } catch (err) {
    console.error("[eobi enrollment GET]", err)
    return internalServerError("Failed to load enrollment")
  }
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ guardId: string }> }
) {
  try {
    const session = (await auth()) as Session | null
    if (!session) return unauthorized()
    if (!hasAction(session, "DEDUCTIONS", "UPDATE")) return forbidden("Access denied")
    const { guardId } = await ctx.params
    // Regional scope: blocks out-of-region writes (also handles 404 if the
    // guard does not exist), replacing the prior bare existence check.
    const denied = await requireGuardInScope(session, guardId)
    if (denied) return denied

    const body = (await request.json()) as Record<string, unknown>
    const isActive = body.isActive === true
    const number = typeof body.eobiNumber === "string" ? body.eobiNumber.trim() : null
    const registrationDate =
      typeof body.registrationDate === "string"
        ? new Date(body.registrationDate)
        : null
    if (registrationDate && Number.isNaN(registrationDate.getTime())) {
      return badRequest("invalid registrationDate")
    }
    const notes = typeof body.notes === "string" ? body.notes : null

    if (isActive && !number) {
      return badRequest("eobiNumber required when activating enrollment")
    }

    const row = await upsertEobiEnrollment(prisma, guardId, {
      isActive,
      number,
      registrationDate,
      notes,
    })
    return ok(row)
  } catch (err) {
    console.error("[eobi enrollment PUT]", err)
    return internalServerError("Failed to upsert enrollment")
  }
}
