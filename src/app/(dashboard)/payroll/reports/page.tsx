import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { payrollScreens, reportLinks } from "@/lib/parity/screenConfigs"
import { renderPayrollRegionGate } from "@/components/payroll/PayrollRegionGate"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

export default async function PayrollReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ regionId?: string }>
}) {
  const { node } = await renderPayrollRegionGate({
    searchParams,
    children: ({ pickerRegions, locked }) => (
      <>
        <section className="ui-card p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[200px]">
              <RegionUrlPicker
                regions={pickerRegions}
                locked={locked}
                includeGlobalOption={!locked}
              />
            </div>
          </div>
        </section>
        <ConfiguredInteractiveScreen config={payrollScreens.reportsHub} links={reportLinks} />
      </>
    ),
    promptText: "Select a region to view payroll reports.",
    promptHint: "Reports are region-scoped. Choose a region above to load them.",
  })

  return <div className="space-y-6">{node}</div>
}
