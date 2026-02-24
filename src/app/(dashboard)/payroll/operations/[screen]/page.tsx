import { notFound, redirect } from "next/navigation"
import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { payrollOperationLinks, payrollOperationScreens } from "@/lib/parity/screenConfigs"

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

  return <ConfiguredInteractiveScreen config={config} links={payrollOperationLinks} />
}
