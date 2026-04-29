import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get("includeInactive") === "true"

    // Read access for any authenticated user. Inactive rows are admin-only.
    const where = includeInactive
      ? hasAction(session, "SETTINGS", "UPDATE")
        ? {}
        : { isActive: true }
      : { isActive: true }

    const categories = await prisma.trainingCategory.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    return ok(categories)
  } catch (error) {
    console.error("GET /api/training-categories:", error)
    return internalServerError("Failed to load training categories.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "SETTINGS", "UPDATE")) return forbidden("Access denied.")

    const json = await request.json().catch(() => null)
    const parsed = createSchema.safeParse(json)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload")

    const { name, description, sortOrder, isActive } = parsed.data
    const trimmedName = name.trim()
    if (!trimmedName) return badRequest("Name is required.")

    const existing = await prisma.trainingCategory.findUnique({ where: { name: trimmedName } })
    if (existing) return conflict("A training category with this name already exists.")

    const resolvedSortOrder =
      sortOrder ??
      ((await prisma.trainingCategory.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1

    const created = await prisma.trainingCategory.create({
      data: {
        name: trimmedName,
        description: description?.trim() || null,
        sortOrder: resolvedSortOrder,
        isActive: isActive ?? true,
      },
    })

    return ok(created, 201)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002")
      return conflict("A training category with this name already exists.")
    console.error("POST /api/training-categories:", error)
    return internalServerError("Failed to create training category.")
  }
}
