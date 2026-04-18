import { redirect } from "next/navigation"

const SCREEN_REDIRECTS: Record<string, string> = {
  loan: "/payroll/loans",
  loans: "/payroll/loans",
  "extra-hours": "/payroll/extra-hours",
  "other-deductions": "/payroll/other-deductions",
  "special-duty": "/payroll/special-duty",
  salary: "/payroll/salary-v2",
  "salary-v1": "/payroll/salary-v2",
  "salary-v2": "/payroll/salary-v2",
  "unpaid-salaries": "/payroll/unpaid-salaries",
  "bulk-salary-slips": "/payroll/bulk-salary-slips",
  clearance: "/payroll/clearance",
  holidays: "/payroll/holidays",
}

export default async function PayrollOperationDetailPage({
  params,
}: {
  params: Promise<{ screen: string }>
}) {
  const { screen } = await params
  redirect(SCREEN_REDIRECTS[screen] ?? "/payroll/loans")
}
