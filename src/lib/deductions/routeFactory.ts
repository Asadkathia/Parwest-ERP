/**
 * Thin route factory for rate-table CRUD.
 *
 * Each per-table route file just calls `buildRateRoutes(table)` to get
 * GET/POST and (separately for [id] sub-routes) approve/supersede handlers
 * that delegate to `src/lib/deductions/rates.ts`.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { prisma } from "@/lib/db"
import {
  approveRate,
  listRates,
  proposeRate,
  RateApiError,
  supersedeRate,
  type ProposeInput,
  type RateTableName,
} from "./rates"

function toResponse(err: unknown) {
  if (err instanceof RateApiError) {
    switch (err.code) {
      case "FORBIDDEN":
        return forbidden(err.message)
      case "BAD_REQUEST":
        return badRequest(err.message)
      case "CONFLICT":
        return conflict(err.message)
      case "NOT_FOUND":
        return notFound(err.message)
    }
  }
  console.error("[deductions/rates]", err)
  return internalServerError("Failed to process rate request")
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string") return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function buildListAndCreateHandlers(table: RateTableName) {
  return {
    async GET(request: NextRequest) {
      try {
        const session = await auth()
        if (!session) return unauthorized()
        const { searchParams } = new URL(request.url)
        const scopeId = searchParams.get("scopeId")
        const status =
          (searchParams.get("status") as
            | "DRAFT"
            | "ACTIVE"
            | "SUPERSEDED"
            | "ALL"
            | null) ?? "ALL"
        const rows = await listRates(prisma, session, table, {
          scopeId: scopeId ?? null,
          status,
        })
        return ok(rows)
      } catch (err) {
        return toResponse(err)
      }
    },

    async POST(request: NextRequest) {
      try {
        const session = await auth()
        if (!session) return unauthorized()
        const body = (await request.json()) as Record<string, unknown>
        const effectiveFrom = parseDate(body.effectiveFrom)
        if (!effectiveFrom) return badRequest("effectiveFrom required")
        const input: ProposeInput = {
          effectiveFrom,
          amount: typeof body.amount === "number" ? body.amount : undefined,
          sourceDocumentUrl:
            typeof body.sourceDocumentUrl === "string" ? body.sourceDocumentUrl : null,
          notes: typeof body.notes === "string" ? body.notes : null,
          branchId: typeof body.branchId === "string" ? body.branchId : undefined,
          regionId: typeof body.regionId === "string" ? body.regionId : undefined,
          totalCost: typeof body.totalCost === "number" ? body.totalCost : undefined,
          installmentAmount:
            typeof body.installmentAmount === "number"
              ? body.installmentAmount
              : undefined,
          installmentCount:
            typeof body.installmentCount === "number"
              ? body.installmentCount
              : undefined,
          minMonths: typeof body.minMonths === "number" ? body.minMonths : undefined,
          maxMonths: typeof body.maxMonths === "number" ? body.maxMonths : undefined,
          callsPerNight:
            typeof body.callsPerNight === "number" ? body.callsPerNight : undefined,
          twoMissedDeduction:
            typeof body.twoMissedDeduction === "number"
              ? body.twoMissedDeduction
              : undefined,
          repeatedDayPenalty:
            typeof body.repeatedDayPenalty === "number"
              ? body.repeatedDayPenalty
              : undefined,
          consecutiveOneMissedWarningDay:
            typeof body.consecutiveOneMissedWarningDay === "number"
              ? body.consecutiveOneMissedWarningDay
              : undefined,
          consecutiveOneMissedDeductionDay:
            typeof body.consecutiveOneMissedDeductionDay === "number"
              ? body.consecutiveOneMissedDeductionDay
              : undefined,
          dayRateBasis:
            body.dayRateBasis === "BASE_DIV_30" || body.dayRateBasis === "CUSTOM"
              ? body.dayRateBasis
              : undefined,
          customDayRate:
            typeof body.customDayRate === "number" ? body.customDayRate : null,
        }
        const created = await proposeRate(prisma, session, table, input)
        return ok(created, 201)
      } catch (err) {
        return toResponse(err)
      }
    },
  }
}

export function buildApproveHandler(table: RateTableName) {
  return async function PATCH(
    _request: NextRequest,
    ctx: { params: Promise<{ id: string }> }
  ) {
    try {
      const session = await auth()
      if (!session) return unauthorized()
      const { id } = await ctx.params
      const approved = await approveRate(prisma, session, table, id)
      return ok(approved)
    } catch (err) {
      return toResponse(err)
    }
  }
}

export function buildSupersedeHandler(table: RateTableName) {
  return async function PATCH(
    request: NextRequest,
    ctx: { params: Promise<{ id: string }> }
  ) {
    try {
      const session = await auth()
      if (!session) return unauthorized()
      const { id } = await ctx.params
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
      const effectiveTo = parseDate(body.effectiveTo)
      if (!effectiveTo) return badRequest("effectiveTo required")
      const reason = typeof body.reason === "string" ? body.reason : undefined
      const updated = await supersedeRate(prisma, session, table, id, effectiveTo, reason)
      return ok(updated)
    } catch (err) {
      return toResponse(err)
    }
  }
}
