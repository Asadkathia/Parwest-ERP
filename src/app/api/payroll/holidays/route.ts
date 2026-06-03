import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

const VALID_VALUE_TYPES = new Set(["FIXED_PER_DAY", "MULTIPLE_OF_RATE"])
const VALID_APPLIES_TO = new Set([
  "WORKED_ONLY",
  "ALL_DEPLOYED_IN_OFFICE",
  "ALL_GUARDS_IN_OFFICE",
])

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")

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
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const body = await request.json()
    const name = String(body?.name || "Holiday").trim()
    const dateFromRaw = body?.dateFrom ? String(body.dateFrom) : body?.date ? String(body.date) : ""
    const dateToRaw = body?.dateTo ? String(body.dateTo) : dateFromRaw
    const regionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId) : null
    const valueTypeRaw = body?.valueType ? String(body.valueType).toUpperCase() : null
    const value = body?.value != null ? Number(body.value) : null
    const status = body?.status ? String(body.status) : "active"
    const comments = body?.comments ? String(body.comments) : null
    const appliesTo = body?.appliesTo ? String(body.appliesTo) : null

    if (!dateFromRaw) return badRequest("dateFrom (or date) is required.")
    if (valueTypeRaw && !VALID_VALUE_TYPES.has(valueTypeRaw)) {
      return badRequest("valueType must be FIXED_PER_DAY or MULTIPLE_OF_RATE.")
    }
    if (appliesTo && !VALID_APPLIES_TO.has(appliesTo)) {
      return badRequest("Invalid appliesTo value.")
    }

    const dateFrom = new Date(dateFromRaw)
    const dateTo = new Date(dateToRaw)
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      return badRequest("Invalid date value.")
    }
    if (dateTo < dateFrom) return badRequest("dateTo must be >= dateFrom.")

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
        appliesTo: appliesTo ?? undefined,
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
