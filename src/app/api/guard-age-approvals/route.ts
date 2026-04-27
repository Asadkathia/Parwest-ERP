import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

// GET - list all age approval requests (optionally filter by status)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "ADMIN_APPROVALS", "VIEW")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // PENDING | APPROVED | REJECTED | null (all)
    const regionIdParam = searchParams.get("regionId")?.trim() || null
    const regionalOfficeIdParam = searchParams.get("regionalOfficeId")?.trim() || null

    const managerScope = deriveManagerScope(session)
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: regionIdParam,
        regionalOfficeId: regionalOfficeIdParam,
      })
    ) {
      return forbidden("Forbidden: cannot query approvals outside your scope.")
    }

    // Build the nested `guard` where clause via relation (GuardAgeApproval
    // has no direct region columns). Start with the auto-scope from the
    // session, then layer URL-param overrides (for Super Users using the
    // picker — scope-denied has already rejected cross-scope attempts from
    // regional users).
    const guardWhere: Prisma.GuardWhereInput = {}
    if (managerScope?.regionId) guardWhere.regionId = managerScope.regionId
    if (managerScope && managerScope.regionalOfficeIds.length > 0) {
      guardWhere.regionalOfficeId =
        managerScope.regionalOfficeIds.length === 1
          ? managerScope.regionalOfficeIds[0]
          : { in: managerScope.regionalOfficeIds }
    }
    if (regionalOfficeIdParam) guardWhere.regionalOfficeId = regionalOfficeIdParam
    if (regionIdParam) guardWhere.regionId = regionIdParam

    const where: Prisma.GuardAgeApprovalWhereInput = {
      ...(status ? { status } : {}),
      ...(Object.keys(guardWhere).length > 0 ? { guard: guardWhere } : {}),
    }

    const approvals = await prisma.guardAgeApproval.findMany({
      where,
      include: {
        guard: {
          select: {
            id: true,
            parwestId: true,
            name: true,
            cnic: true,
            status: true,
            dateOfBirth: true,
            regionalOffice: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(approvals)
  } catch (error) {
    console.error("GET /api/guard-age-approvals:", error)
    return internalServerError("Failed to fetch age approvals")
  }
}
