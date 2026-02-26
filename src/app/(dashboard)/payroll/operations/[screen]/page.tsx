import { notFound, redirect } from "next/navigation"
import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { payrollOperationLinks, payrollOperationScreens } from "@/lib/parity/screenConfigs"
import PayrollLoanManager from "@/components/payroll/PayrollLoanManager"
import PayrollExtraHoursManager from "@/components/payroll/PayrollExtraHoursManager"
import PayrollOtherDeductionsManager from "@/components/payroll/PayrollOtherDeductionsManager"
import PayrollSpecialDutyManager from "@/components/payroll/PayrollSpecialDutyManager"
import PayrollSalaryV2Manager from "@/components/payroll/PayrollSalaryV2Manager"
import PayrollUnpaidSalariesManager from "@/components/payroll/PayrollUnpaidSalariesManager"
import PayrollBulkSalarySlipsManager from "@/components/payroll/PayrollBulkSalarySlipsManager"
import PayrollClearanceManager from "@/components/payroll/PayrollClearanceManager"
import PayrollHolidaysManager from "@/components/payroll/PayrollHolidaysManager"

export default async function PayrollOperationDetailPage({
  params,
}: {
  params: Promise<{ screen: string }>
}) {
  const { screen } = await params
  if (screen === "salary-v1" || screen === "salary") {
    redirect("/payroll/operations/salary-v2")
  }
  const config = payrollOperationScreens[screen]

  if (!config) {
    notFound()
  }

  if (screen === "loan") {
    return <PayrollLoanManager />
  }
  if (screen === "extra-hours") {
    return <PayrollExtraHoursManager />
  }
  if (screen === "other-deductions") {
    return <PayrollOtherDeductionsManager />
  }
  if (screen === "special-duty") {
    return <PayrollSpecialDutyManager />
  }
  if (screen === "salary-v2") {
    return <PayrollSalaryV2Manager />
  }
  if (screen === "unpaid-salaries") {
    return <PayrollUnpaidSalariesManager />
  }
  if (screen === "bulk-salary-slips") {
    return <PayrollBulkSalarySlipsManager />
  }
  if (screen === "clearance") {
    return <PayrollClearanceManager />
  }
  if (screen === "holidays") {
    return <PayrollHolidaysManager />
  }

  return <ConfiguredInteractiveScreen config={config} links={payrollOperationLinks} />
}
