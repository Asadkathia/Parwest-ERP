import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { parseMonthRange, parseMonthStart } from "@/lib/payroll/date-helpers"

const ALLOWED_LOAN_STATUSES = new Set(["PENDING", "FINALIZED"])

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const guardId = searchParams.get("guardId") || undefined
    const month = searchParams.get("month") || undefined
    const search = searchParams.get("search") || undefined
    const regionIdParam = searchParams.get("regionId")?.trim() || null
    const regionalOfficeIdParam = searchParams.get("regionalOfficeId")?.trim() || null

    // Reject cross-scope requests early so a regional user can't request
    // another region's data even with a crafted URL.
    if (managerScope && managerScopeDenied(managerScope, {
      regionId: regionIdParam,
      regionalOfficeId: regionalOfficeIdParam,
    })) {
      return forbidden("Forbidden: cannot query loans outside your scope.")
    }

    const where: Prisma.LoanWhereInput = {}
    if (status && !ALLOWED_LOAN_STATUSES.has(status)) {
      return badRequest("status must be PENDING or FINALIZED.")
    }
    if (status) where.status = status
    if (guardId) where.guardId = guardId
    if (month) {
      const range = parseMonthRange(month)
      if (!range) return badRequest("Invalid month value.")
      where.month = { gte: range.start, lt: range.end }
    }
    if (search) {
      where.OR = [
        { guard: { name: { contains: search, mode: "insensitive" } } },
        { guard: { parwestId: { contains: search, mode: "insensitive" } } },
      ]
    }

    // Build the guard-scope filter. Loan has its own `regionId`, but guard is
    // the authoritative source (Loan.regionId is a denormalized copy at create
    // time). Filter through the guard relation for both URL params and the
    // caller's manager scope.
    const guardFilter: Record<string, unknown> = {}
    if (managerScope?.regionId) guardFilter.regionId = managerScope.regionId
    if (managerScope && managerScope.regionalOfficeIds.length > 0) {
      guardFilter.regionalOfficeId = { in: managerScope.regionalOfficeIds }
    }
    if (regionIdParam) guardFilter.regionId = regionIdParam
    if (regionalOfficeIdParam) guardFilter.regionalOfficeId = regionalOfficeIdParam
    if (Object.keys(guardFilter).length > 0) where.guard = { is: guardFilter }

    const loans = await prisma.loan.findMany({
      where,
      include: {
        guard: {
          select: {
            id: true,
            name: true,
            parwestId: true,
            phone: true,
            designation: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })

    return NextResponse.json(loans)
  } catch (error) {
    console.error("Error fetching payroll loans:", error)
    return internalServerError("Failed to fetch payroll loans")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()

    if (!body.guardId || !body.month || body.amount == null) {
      return badRequest("guardId, month and amount are required.")
    }

    const guard = await prisma.guard.findUnique({
      where: { id: String(body.guardId) },
      select: { id: true, regionId: true, regionalOfficeId: true, lifecycleStatus: true },
    })

    if (!guard) {
      return notFound("Guard not found.")
    }
    if (managerScope && managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
      return forbidden("Forbidden: guard is outside your scope.")
    }
    if (guard.lifecycleStatus === "TERMINATED" || guard.lifecycleStatus === "INACTIVE") {
      return badRequest(
        `Cannot create a loan for a ${String(guard.lifecycleStatus).toLowerCase()} guard.`,
      )
    }

    const month = parseMonthStart(String(body.month))
    if (!month) {
      return badRequest("Invalid month value.")
    }

    const paymentDate = body.paymentDate ? new Date(String(body.paymentDate)) : null
    const created = await prisma.loan.create({
      data: {
        guardId: guard.id,
        month,
        amount: Number(body.amount),
        status: String(body.status || "PENDING"),
        deploymentDays: body.deploymentDays != null ? Number(body.deploymentDays) : null,
        supervisor: body.supervisor ? String(body.supervisor) : null,
        manager: body.manager ? String(body.manager) : null,
        regionId: guard.regionId ?? null,
        supervisorUserId: body.supervisorUserId ? String(body.supervisorUserId) : null,
        managerUserId: body.managerUserId ? String(body.managerUserId) : null,
        slipNumber: body.slipNumber ? String(body.slipNumber) : null,
        paymentDate: paymentDate && !Number.isNaN(paymentDate.getTime()) ? paymentDate : null,
        paymentMethod: body.paymentMethod ? String(body.paymentMethod).toUpperCase() : null,
        bankName: body.bankName ? String(body.bankName) : null,
        accountNumber: body.accountNumber ? String(body.accountNumber) : null,
        imageBase64: body.imageBase64 ? String(body.imageBase64) : null,
        issuerId: session.user?.id ?? null,
      },
      include: {
        guard: {
          select: {
            id: true,
            name: true,
            parwestId: true,
          },
        },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2003") {
      return badRequest("Invalid relation provided.")
    }
    console.error("Error creating payroll loan:", error)
    return internalServerError("Failed to create payroll loan")
  }
}
