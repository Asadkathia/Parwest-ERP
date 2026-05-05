/**
 * GET  /api/deductions/enrollments/essi/[guardId] → current enrollment or null
 * PUT  /api/deductions/enrollments/essi/[guardId] → upsert enrollment
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
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { upsertEssiEnrollment } from "@/lib/deductions/enrollments"

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ guardId: string }> }
) {
  try {
    const session = (await auth()) as Session | null
    if (!session) return unauthorized()
    if (!hasAction(session, "DEDUCTIONS", "VIEW")) return forbidden("Access denied")
    const { guardId } = await ctx.params
    const row = await prisma.essiEnrollment.findUnique({ where: { guardId } })
    return ok(row)
  } catch (err) {
    console.error("[essi enrollment GET]", err)
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
    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true },
    })
    if (!guard) return notFound("Guard not found")

    const body = (await request.json()) as Record<string, unknown>
    const isActive = body.isActive === true
    const number = typeof body.essiNumber === "string" ? body.essiNumber.trim() : null
    const registrationDate =
      typeof body.registrationDate === "string"
        ? new Date(body.registrationDate)
        : null
    if (registrationDate && Number.isNaN(registrationDate.getTime())) {
      return badRequest("invalid registrationDate")
    }
    const notes = typeof body.notes === "string" ? body.notes : null

    if (isActive && !number) {
      return badRequest("essiNumber required when activating enrollment")
    }

    const row = await upsertEssiEnrollment(prisma, guardId, {
      isActive,
      number,
      registrationDate,
      notes,
    })
    return ok(row)
  } catch (err) {
    console.error("[essi enrollment PUT]", err)
    return internalServerError("Failed to upsert enrollment")
  }
}
