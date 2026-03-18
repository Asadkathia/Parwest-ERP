import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.guardDocumentType.findUnique({ where: { id } })
    if (!existing) return notFound("Document type not found")

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return badRequest("Name cannot be empty")
      // Check uniqueness if name is changing
      if (name !== existing.name) {
        const conflict = await prisma.guardDocumentType.findUnique({ where: { name } })
        if (conflict) return badRequest("A document type with this name already exists")
      }
      data.name = name
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder)
    if (body.docCategory !== undefined) {
      if (!["VERIFICATION", "ATTACHMENT"].includes(body.docCategory))
        return badRequest("Invalid docCategory. Must be VERIFICATION or ATTACHMENT")
      data.docCategory = body.docCategory
    }

    const updated = await prisma.guardDocumentType.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/guard-document-types/[id]:", error)
    return internalServerError("Failed to update document type")
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await params
    const existing = await prisma.guardDocumentType.findUnique({ where: { id } })
    if (!existing) return notFound("Document type not found")

    await prisma.guardDocumentType.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/guard-document-types/[id]:", error)
    return internalServerError("Failed to delete document type")
  }
}
