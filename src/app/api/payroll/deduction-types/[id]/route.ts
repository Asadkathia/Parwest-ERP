import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")

    const { id } = await params
    const row = await prisma.payrollDeductionType.findUnique({ where: { id } })
    if (!row) return notFound("Deduction type not found.")
    return ok(row)
  } catch (error) {
    console.error("Error fetching payroll deduction type:", error)
    return internalServerError("Failed to fetch deduction type.")
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")

    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") return badRequest("Invalid request body.")

    if (body.code !== undefined) {
      return badRequest("Code is a stable identifier and cannot be changed.")
    }

    const data: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      if (!name) return badRequest("Name cannot be empty.")
      data.name = name
    }

    if (body.description !== undefined) {
      data.description =
        typeof body.description === "string" && body.description.trim() !== ""
          ? body.description.trim()
          : null
    }

    if (body.defaultAmount !== undefined) {
      const parsed = Number(body.defaultAmount)
      if (!Number.isFinite(parsed) || parsed < 0)
        return badRequest("defaultAmount must be a finite number ≥ 0.")
      data.defaultAmount = parsed
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive)
    }

    if (body.sortOrder !== undefined) {
      const parsed = Number(body.sortOrder)
      if (!Number.isFinite(parsed)) return badRequest("sortOrder must be a finite number.")
      data.sortOrder = parsed
    }

    const updated = await prisma.payrollDeductionType.update({ where: { id }, data })
    return ok(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025")
      return notFound("Deduction type not found.")
    console.error("Error updating payroll deduction type:", error)
    return internalServerError("Failed to update deduction type.")
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get("hardDelete") === "true"

    const existing = await prisma.payrollDeductionType.findUnique({ where: { id } })
    if (!existing) return notFound("Deduction type not found.")

    if (hardDelete) {
      const entryCount = await prisma.payrollDeductionEntry.count({
        where: { deductionTypeId: id },
      })
      if (entryCount > 0) {
        return conflict(
          `Cannot hard-delete: ${entryCount} payroll entries reference this deduction type. Deactivate instead.`
        )
      }
      await prisma.payrollDeductionType.delete({ where: { id } })
      return ok({ deleted: true })
    }

    await prisma.payrollDeductionType.update({
      where: { id },
      data: { isActive: false },
    })
    return ok({ deactivated: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025")
      return notFound("Deduction type not found.")
    console.error("Error deleting payroll deduction type:", error)
    return internalServerError("Failed to delete deduction type.")
  }
}
