import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasModuleAccess } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import PayrollDeductionLines from "@/components/payroll/PayrollDeductionLines"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"

export const dynamic = "force-dynamic"

export default async function PayrollDeductionsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasModuleAccess(session, "PAYROLL")) redirect("/")

  const { id } = await params
  const payroll = await prisma.payroll.findUnique({
    where: { id },
    select: {
      id: true,
      month: true,
      year: true,
      state: true,
      paymentStatus: true,
      baseSalary: true,
      netSalary: true,
      reserveAmount: true,
      guard: { select: { id: true, name: true, parwestId: true } },
    },
  })
  if (!payroll) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Payroll not found</h1>
      </div>
    )
  }

  const monthLabel = new Date(payroll.month).toISOString().slice(0, 7)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payroll deductions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {payroll.guard.name} ({payroll.guard.parwestId}) · {monthLabel} · state{" "}
          <span className="font-mono">{payroll.state}</span>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">Base salary</CardTitle>
          </CardHeader>
          <CardContent>
            <ParwestCurrency value={Number(payroll.baseSalary)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">Reserve</CardTitle>
          </CardHeader>
          <CardContent>
            <ParwestCurrency value={Number(payroll.reserveAmount)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">Net payable</CardTitle>
          </CardHeader>
          <CardContent>
            <ParwestCurrency value={Number(payroll.netSalary)} />
          </CardContent>
        </Card>
      </div>

      <PayrollDeductionLines payrollId={payroll.id} />
    </div>
  )
}
