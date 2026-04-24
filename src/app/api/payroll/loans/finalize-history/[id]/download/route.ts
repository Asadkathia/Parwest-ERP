import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

function csvEscape(value: unknown): string {
  if (value == null) return ""
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")

    const { id } = await params
    const record = await prisma.payrollLoanFinalizationHistory.findUnique({ where: { id } })
    if (!record) return notFound("Finalization record not found.")

    const loanIds: string[] = JSON.parse(record.loanIdsJson)
    const loans = await prisma.loan.findMany({
      where: { id: { in: loanIds } },
      include: {
        guard: { select: { parwestId: true, name: true, phone: true, cnic: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    const headers = [
      "Parwest ID",
      "Name",
      "CNIC",
      "Phone",
      "Amount",
      "Slip Number",
      "Payment Method",
      "Bank Name",
      "Account Number",
      "Payment Date",
      "Supervisor",
      "Manager",
    ]
    const rows = loans.map((l) => [
      l.guard.parwestId,
      l.guard.name,
      l.guard.cnic,
      l.guard.phone ?? "",
      l.amount,
      l.slipNumber ?? "",
      l.paymentMethod ?? "",
      l.bankName ?? "",
      l.accountNumber ?? "",
      l.paymentDate ? l.paymentDate.toISOString().slice(0, 10) : "",
      l.supervisor ?? "",
      l.manager ?? "",
    ])

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")
    const fileName = `loan-finalization-${record.month.toISOString().slice(0, 7)}-${record.id}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error("Error downloading finalization:", error)
    return internalServerError("Failed to download.")
  }
}
