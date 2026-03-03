import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"

const MOCK_ROWS = [
  { id: "mock-holiday-1", name: "Pakistan Day", date: "2026-03-23T00:00:00.000Z", notes: "National holiday" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    if (isRuntimeMockEnabled()) return NextResponse.json(MOCK_ROWS)

    const rows = await prisma.payrollHoliday.findMany({
      orderBy: { date: "desc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for payroll holidays yet.")
    }
    console.error("Error fetching payroll holidays:", error)
    return internalServerError("Failed to fetch holidays.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const body = await request.json()
    const name = String(body?.name || "").trim()
    const dateRaw = String(body?.date || "").trim()
    const notes = body?.notes ? String(body.notes) : null

    if (!name || !dateRaw) {
      return badRequest("name and date are required.")
    }
    const date = new Date(dateRaw)
    if (Number.isNaN(date.getTime())) {
      return badRequest("Invalid date value.")
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json({ id: `mock-holiday-${Date.now()}`, name, date: date.toISOString(), notes }, { status: 201 })
    }

    const created = await prisma.payrollHoliday.create({
      data: { name, date, notes },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for payroll holidays yet.")
    }
    console.error("Error creating payroll holiday:", error)
    return internalServerError("Failed to create holiday.")
  }
}
