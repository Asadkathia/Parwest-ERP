import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

const CODE_REGEX = /^[A-Z][A-Z0-9_]*$/

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") === "true"

    const rows = await prisma.payrollDeductionType.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    return ok(rows)
  } catch (error) {
    console.error("Error fetching payroll deduction types:", error)
    return internalServerError("Failed to fetch deduction types.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") return badRequest("Invalid request body.")

    const code = typeof body.code === "string" ? body.code.trim() : ""
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const description =
      typeof body.description === "string" && body.description.trim() !== ""
        ? body.description.trim()
        : null

    if (!code) return badRequest("Code is required.")
    if (!CODE_REGEX.test(code))
      return badRequest("Code must be uppercase letters, digits, and underscores (start with letter).")
    if (!name) return badRequest("Name is required.")

    let defaultAmount = 0
    if (body.defaultAmount !== undefined && body.defaultAmount !== null && body.defaultAmount !== "") {
      const parsed = Number(body.defaultAmount)
      if (!Number.isFinite(parsed) || parsed < 0)
        return badRequest("defaultAmount must be a finite number ≥ 0.")
      defaultAmount = parsed
    }

    const isActive = body.isActive === undefined ? true : Boolean(body.isActive)
    const sortOrder = body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== ""
      ? Number(body.sortOrder)
      : 0
    if (!Number.isFinite(sortOrder)) return badRequest("sortOrder must be a finite number.")

    const userName =
      (session.user as { name?: string })?.name ??
      (session.user as { email?: string })?.email ??
      null

    try {
      const created = await prisma.payrollDeductionType.create({
        data: {
          code,
          name,
          description,
          defaultAmount,
          isActive,
          sortOrder,
          createdById: session.user?.id ?? null,
          createdByName: userName,
        },
      })
      return ok(created, 201)
    } catch (error: unknown) {
      if (String((error as { code?: string }).code) === "P2002") {
        return conflict(`A deduction type with code "${code}" already exists.`)
      }
      throw error
    }
  } catch (error) {
    console.error("Error creating payroll deduction type:", error)
    return internalServerError("Failed to create deduction type.")
  }
}
