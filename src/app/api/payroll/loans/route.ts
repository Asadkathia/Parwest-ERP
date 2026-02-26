import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const guardId = searchParams.get("guardId") || undefined
    const month = searchParams.get("month") || undefined
    const search = searchParams.get("search") || undefined

    const where: any = {}
    if (status) where.status = status
    if (guardId) where.guardId = guardId
    if (month) {
      const parsedMonth = new Date(month)
      if (!Number.isNaN(parsedMonth.getTime())) {
        where.month = parsedMonth
      }
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

    const loans = await prisma.loan.findMany({
      where,
      include: {
        guard: {
          select: {
            id: true,
            name: true,
            parwestId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })

    return NextResponse.json(loans)
  } catch (error) {
    console.error("Error fetching payroll loans:", error)
    return NextResponse.json({ message: "Failed to fetch payroll loans" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    const managerScope = deriveManagerScope(session)

    const body = await request.json()

    if (!body.guardId || !body.month || body.amount == null) {
      return NextResponse.json(
        { message: "guardId, month and amount are required." },
        { status: 400 }
      )
    }

    const guard = await prisma.guard.findUnique({
      where: { id: String(body.guardId) },
      select: { id: true, regionId: true, regionalOfficeId: true },
    })

    if (!guard) {
      return NextResponse.json({ message: "Guard not found." }, { status: 404 })
    }
    if (managerScope && managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
      return NextResponse.json({ message: "Forbidden: guard is outside your scope." }, { status: 403 })
    }

    const month = new Date(String(body.month))
    if (Number.isNaN(month.getTime())) {
      return NextResponse.json({ message: "Invalid month value." }, { status: 400 })
    }

    const created = await prisma.loan.create({
      data: {
        guardId: guard.id,
        month,
        amount: Number(body.amount),
        status: String(body.status || "PENDING"),
        deploymentDays: body.deploymentDays != null ? Number(body.deploymentDays) : null,
        supervisor: body.supervisor ? String(body.supervisor) : null,
        manager: body.manager ? String(body.manager) : null,
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
  } catch (error: any) {
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Invalid relation provided." }, { status: 400 })
    }
    console.error("Error creating payroll loan:", error)
    return NextResponse.json({ message: "Failed to create payroll loan" }, { status: 500 })
  }
}
