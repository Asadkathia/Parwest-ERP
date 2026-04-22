import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { internalServerError, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

// GET - list all age approval requests (optionally filter by status)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "GUARDS")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // PENDING | APPROVED | REJECTED | null (all)

    const approvals = await prisma.guardAgeApproval.findMany({
      where: status ? { status } : {},
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
