import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

const MOCK_ROWS = [
  { id: "mock-holiday-1", name: "Pakistan Day", date: "2026-03-23T00:00:00.000Z", notes: "National holiday" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    if (isMockEnabled()) return NextResponse.json(MOCK_ROWS)

    const rows = await prisma.payrollHoliday.findMany({
      orderBy: { date: "desc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      return NextResponse.json({ message: "Schema not migrated for payroll holidays yet." }, { status: 503 })
    }
    console.error("Error fetching payroll holidays:", error)
    return NextResponse.json({ message: "Failed to fetch holidays." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const name = String(body?.name || "").trim()
    const dateRaw = String(body?.date || "").trim()
    const notes = body?.notes ? String(body.notes) : null

    if (!name || !dateRaw) {
      return NextResponse.json({ message: "name and date are required." }, { status: 400 })
    }
    const date = new Date(dateRaw)
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ message: "Invalid date value." }, { status: 400 })
    }

    if (isMockEnabled()) {
      return NextResponse.json({ id: `mock-holiday-${Date.now()}`, name, date: date.toISOString(), notes }, { status: 201 })
    }

    const created = await prisma.payrollHoliday.create({
      data: { name, date, notes },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      return NextResponse.json({ message: "Schema not migrated for payroll holidays yet." }, { status: 503 })
    }
    console.error("Error creating payroll holiday:", error)
    return NextResponse.json({ message: "Failed to create holiday." }, { status: 500 })
  }
}
