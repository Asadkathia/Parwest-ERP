import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"

const MOCK_ROWS = [
  {
    id: "mock-holiday-1",
    name: "Pakistan Day",
    date: "2026-03-23T00:00:00.000Z",
    dateFrom: "2026-03-23T00:00:00.000Z",
    dateTo: "2026-03-23T00:00:00.000Z",
    regionalOfficeId: null,
    valueType: "FIXED_PER_DAY",
    value: 1000,
    status: "active",
    comments: null,
    notes: null,
  },
]

const VALID_VALUE_TYPES = new Set(["FIXED_PER_DAY", "MULTIPLE_OF_RATE"])

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    if (isRuntimeMockEnabled()) return NextResponse.json(MOCK_ROWS)

    const rows = await prisma.payrollHoliday.findMany({
      orderBy: [{ dateFrom: "desc" }, { date: "desc" }],
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
    const name = String(body?.name || "Holiday").trim()
    const dateFromRaw = body?.dateFrom ? String(body.dateFrom) : body?.date ? String(body.date) : ""
    const dateToRaw = body?.dateTo ? String(body.dateTo) : dateFromRaw
    const regionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId) : null
    const valueTypeRaw = body?.valueType ? String(body.valueType).toUpperCase() : null
    const value = body?.value != null ? Number(body.value) : null
    const status = body?.status ? String(body.status) : "active"
    const comments = body?.comments ? String(body.comments) : null

    if (!dateFromRaw) return badRequest("dateFrom (or date) is required.")
    if (valueTypeRaw && !VALID_VALUE_TYPES.has(valueTypeRaw)) {
      return badRequest("valueType must be FIXED_PER_DAY or MULTIPLE_OF_RATE.")
    }

    const dateFrom = new Date(dateFromRaw)
    const dateTo = new Date(dateToRaw)
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      return badRequest("Invalid date value.")
    }
    if (dateTo < dateFrom) return badRequest("dateTo must be >= dateFrom.")

    if (isRuntimeMockEnabled()) {
      return NextResponse.json(
        {
          id: `mock-holiday-${Date.now()}`,
          name,
          date: dateFrom.toISOString(),
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString(),
          regionalOfficeId,
          valueType: valueTypeRaw,
          value,
          status,
          comments,
        },
        { status: 201 }
      )
    }

    const created = await prisma.payrollHoliday.create({
      data: {
        name,
        date: dateFrom,
        dateFrom,
        dateTo,
        regionalOfficeId,
        valueType: valueTypeRaw,
        value,
        status,
        comments,
      },
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
