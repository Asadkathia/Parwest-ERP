import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<unknown> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = (await context.params) as { id: string }

    if (isMockEnabled()) return NextResponse.json({ success: true })

    await prisma.managerSupervisorAssignment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) {
      return NextResponse.json({ message: "Schema not migrated for manager/supervisor assignments yet." }, { status: 503 })
    }
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Relationship not found." }, { status: 404 })
    console.error("Error deleting manager/supervisor relationship:", error)
    return NextResponse.json({ message: "Failed to delete relationship" }, { status: 500 })
  }
}
