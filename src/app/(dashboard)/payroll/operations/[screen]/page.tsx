import { notFound } from "next/navigation"
import UiDocScreen from "@/components/parity/UiDocScreen"
import { payrollOperationLinks, payrollOperationScreens } from "@/lib/parity/screenConfigs"

export default async function PayrollOperationDetailPage({
  params,
}: {
  params: Promise<{ screen: string }>
}) {
  const { screen } = await params
  const config = payrollOperationScreens[screen]

  if (!config) {
    notFound()
  }

  return <UiDocScreen {...config} links={payrollOperationLinks} />
}
