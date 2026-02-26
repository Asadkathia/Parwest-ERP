import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"

const MOCK_USERS = [
  {
    id: "mock-user-1",
    name: "Admin User",
    email: "admin@parwestgroup.com",
    status: "ACTIVE",
    role: { id: "mock-role-admin", name: "Admin" },
    region: { id: "mock-region-punjab", name: "Punjab" },
    regionalOffice: { id: "mock-office-lhr", name: "head office lahore" },
    createdAt: "2026-01-11T00:00:00.000Z",
  },
  {
    id: "mock-user-2",
    name: "Muhammad Nazir",
    email: "nazir@parwestgroup.com",
    status: "ACTIVE",
    role: { id: "mock-role-manager", name: "Manager" },
    region: { id: "mock-region-punjab", name: "Punjab" },
    regionalOffice: { id: "mock-office-lhr", name: "head office lahore" },
    createdAt: "2026-01-14T00:00:00.000Z",
  },
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim()
    const status = searchParams.get("status")?.trim() || undefined
    const roleId = searchParams.get("roleId")?.trim() || undefined
    const regionalOfficeId = searchParams.get("regionalOfficeId")?.trim() || undefined

    if (isMockEnabled()) {
      const rows = MOCK_USERS.filter((user) => {
        if (status && user.status !== status) return false
        if (roleId && user.role.id !== roleId) return false
        if (regionalOfficeId && user.regionalOffice.id !== regionalOfficeId) return false
        if (search) {
          const hay = `${user.name} ${user.email} ${user.role.name}`.toLowerCase()
          if (!hay.includes(search.toLowerCase())) return false
        }
        return true
      })
      return NextResponse.json(rows)
    }

    const where: any = {}
    if (status) where.status = status
    if (roleId) where.roleId = roleId
    if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        role: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        regionalOffice: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ message: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const email = String(body?.email || "").trim().toLowerCase()
    const password = String(body?.password || "")
    const roleId = String(body?.roleId || "").trim()
    const status = String(body?.status || "ACTIVE")
    const contactNumber = body?.contactNumber ? String(body.contactNumber) : null
    const regionId = body?.regionId ? String(body.regionId) : null
    const regionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId) : null

    if (!name || !email || !password || !roleId) {
      return NextResponse.json(
        { message: "name, email, password, and roleId are required." },
        { status: 400 }
      )
    }

    if (isMockEnabled()) {
      return NextResponse.json(
        {
          id: `mock-user-${Date.now()}`,
          name,
          email,
          status,
          contactNumber,
          role: { id: roleId, name: "Role" },
          region: regionId ? { id: regionId, name: "Region" } : null,
          regionalOffice: regionalOfficeId ? { id: regionalOfficeId, name: "Office" } : null,
          createdAt: new Date().toISOString(),
        },
        { status: 201 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roleId,
        status,
        contactNumber,
        regionId,
        regionalOfficeId,
      },
      include: {
        role: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        regionalOffice: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ message: "Email already exists." }, { status: 409 })
    }
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Invalid role, region, or office." }, { status: 400 })
    }
    console.error("Error creating user:", error)
    return NextResponse.json({ message: "Failed to create user" }, { status: 500 })
  }
}
