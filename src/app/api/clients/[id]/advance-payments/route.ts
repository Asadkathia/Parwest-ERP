import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import { clientInScope } from "@/lib/clients/access"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id: clientId } = await params
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    })
    if (!client) return notFound("Client not found.")
    // Branch-based scoping (B1): in-scope = has a branch in the manager's
    // region/office (or branchless client in it).
    if (!(await clientInScope(clientId, managerScope))) {
      return forbidden("Forbidden: client is outside your scope.")
    }

    const rows = await prisma.clientAdvancePayment.findMany({
      where: { clientId },
      include: {
        branch: { select: { id: true, name: true } },
        applications: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, month: true } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching advance payments:", error)
    return internalServerError("Failed to fetch advance payments")
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id: clientId } = await params
    const body = await request.json()
    const amount = Number(body?.amount)
    if (!Number.isFinite(amount) || amount <= 0) return badRequest("amount must be > 0.")

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    })
    if (!client) return notFound("Client not found.")
    // Branch-based scoping (B1): in-scope = has a branch in the manager's
    // region/office (or branchless client in it).
    if (!(await clientInScope(clientId, managerScope))) {
      return forbidden("Forbidden: client is outside your scope.")
    }

    const branchId = body?.branchId ? String(body.branchId) : null
    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, clientId: true },
      })
      if (!branch || branch.clientId !== clientId) {
        return badRequest("branchId does not belong to this client.")
      }
    }

    const created = await prisma.clientAdvancePayment.create({
      data: {
        clientId,
        branchId,
        amount: round2(amount),
        paymentDate: body?.paymentDate ? new Date(body.paymentDate) : new Date(),
        method: body?.method ? String(body.method) : null,
        reference: body?.reference ? String(body.reference) : null,
        notes: body?.notes ? String(body.notes) : null,
        recordedBy: session.user?.id || null,
      },
      include: { branch: { select: { id: true, name: true } } },
    })

    await safeAuditLog({
      userId: session.user?.id || null,
      event: "CLIENT_ADVANCE_RECORDED",
      module: "PAYROLL",
      description: `Recorded advance ${amount} for client ${clientId}${branchId ? ` (branch ${branchId})` : ""}`,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Error recording advance payment:", error)
    return internalServerError("Failed to record advance payment")
  }
}
