import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "SETTINGS", "UPDATE")) return forbidden("Access denied.")

    const { id } = await context.params
    const json = await request.json().catch(() => null)
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload")

    const data: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) {
      const trimmed = parsed.data.name.trim()
      if (!trimmed) return badRequest("Name cannot be empty.")
      data.name = trimmed
    }
    if (parsed.data.description !== undefined) {
      data.description = parsed.data.description?.trim() || null
    }
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive

    if (Object.keys(data).length === 0) return badRequest("No fields provided.")

    const existing = await prisma.trainingCategory.findUnique({ where: { id } })
    if (!existing) return notFound("Training category not found.")

    const updated = await prisma.trainingCategory.update({ where: { id }, data })
    return ok(updated)
  } catch (error: unknown) {
    const code = (error as { code?: string }).code
    if (code === "P2025") return notFound("Training category not found.")
    if (code === "P2002") return conflict("A training category with this name already exists.")
    console.error("PATCH /api/training-categories/[id]:", error)
    return internalServerError("Failed to update training category.")
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "SETTINGS", "UPDATE")) return forbidden("Access denied.")

    const { id } = await context.params
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get("hard") === "true"

    const existing = await prisma.trainingCategory.findUnique({ where: { id } })
    if (!existing) return notFound("Training category not found.")

    if (hardDelete) {
      if (!hasAction(session, "SETTINGS", "DELETE"))
        return forbidden("Hard delete requires SETTINGS:DELETE permission.")

      const refCount = await prisma.ojtTrainingCheck.count({ where: { categoryId: id } })
      if (refCount > 0) {
        return conflict(
          `Cannot hard delete: ${refCount} OJT training check(s) reference this category. Soft-delete (deactivate) instead.`
        )
      }

      await prisma.trainingCategory.delete({ where: { id } })
      return ok({ success: true, hardDeleted: true })
    }

    // Soft delete = deactivate
    const updated = await prisma.trainingCategory.update({
      where: { id },
      data: { isActive: false },
    })
    return ok({ success: true, hardDeleted: false, category: updated })
  } catch (error: unknown) {
    const code = (error as { code?: string }).code
    if (code === "P2025") return notFound("Training category not found.")
    if (code === "P2003")
      return conflict("This category is referenced by existing OJT records and cannot be hard-deleted.")
    console.error("DELETE /api/training-categories/[id]:", error)
    return internalServerError("Failed to delete training category.")
  }
}
