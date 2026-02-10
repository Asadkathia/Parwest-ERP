import UiDocScreen from "@/components/parity/UiDocScreen"

export default function PayrollSettingsPage() {
  return (
    <UiDocScreen
      title="Payroll Settings"
      description="Payroll defaults, month initialize, and limits from UI docs."
      tabs={["Payroll Defaults", "Month Initialise", "Limits"]}
      sections={[
        {
          title: "Payroll Defaults",
          fields: [
            { label: "Training School Fees", type: "number" },
            { label: "CWF", type: "number" },
            { label: "Age Threshold", type: "number" },
            { label: "Deployment Threshold", type: "number" },
          ],
        },
        {
          title: "Month Initialise",
          fields: [
            { label: "Current Month", type: "month" },
            { label: "Next Month", type: "month" },
            { label: "Unposted Regions", type: "select" },
          ],
        },
        {
          title: "Limits",
          fields: [
            { label: "Guard Age Limit", type: "number" },
            { label: "Mental Health Limit", type: "number" },
          ],
        },
      ]}
      actions={["Save Defaults", "Initialize Month", "Save Limits"]}
    />
  )
}
