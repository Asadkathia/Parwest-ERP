import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const managerScope = deriveManagerScope(session)
    const { searchParams } = new URL(request.url)
    const monthRaw = searchParams.get("month")
    const search = searchParams.get("search") || undefined

    const where: any = { paymentStatus: "UNPAID" }
    if (monthRaw) {
      const month = new Date(monthRaw)
      if (!Number.isNaN(month.getTime())) where.month = month
    }
    if (search) {
      where.OR = [
        { guard: { name: { contains: search, mode: "insensitive" } } },
        { guard: { parwestId: { contains: search, mode: "insensitive" } } },
      ]
    }
    if (managerScope) {
      const isFilter: Record<string, unknown> = {}
      if (managerScope.regionId) isFilter.regionId = managerScope.regionId
      if (managerScope.regionalOfficeIds.length > 0) {
        isFilter.regionalOfficeId = { in: managerScope.regionalOfficeIds }
      }
      if (Object.keys(isFilter).length > 0) where.guard = { is: isFilter }
    }

    const rows = await prisma.payroll.findMany({
      where,
      include: {
        guard: { select: { id: true, name: true, parwestId: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching unpaid payroll:", error)
    return NextResponse.json({ message: "Failed to fetch unpaid salaries." }, { status: 500 })
  }
}
