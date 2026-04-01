type GuardLifecycleProgressProps = {
  guardStatus: string
  verificationTotal: number
  verificationVerified: number
  assignedInventoryCount: number
  activeDeploymentsCount: number
  revokedDeploymentsCount: number
  currentDeployment?: {
    clientName: string
    branchName: string | null
    shiftType: string | null
    designation: string | null
    deploymentDate: string | null
  } | null
  latestEndedDeployment?: {
    clientName: string
    branchName: string | null
    endDate: string | null
    endReason: string | null
  } | null
}

type Step = {
  key: "enrolled" | "verified" | "inventory" | "deployed" | "revoked"
  label: string
  complete: boolean
}

function buildSteps(props: GuardLifecycleProgressProps): Step[] {
  const isVerified =
    (props.verificationTotal > 0 && props.verificationVerified === props.verificationTotal) ||
    props.guardStatus === "ACTIVE"
  const hasInventory = props.assignedInventoryCount > 0
  const isDeployed = props.activeDeploymentsCount > 0
  const isRevoked = !isDeployed && props.revokedDeploymentsCount > 0

  return [
    { key: "enrolled", label: "Enrolled", complete: true },
    { key: "verified", label: "Verified", complete: isVerified },
    { key: "inventory", label: "Inventory Assigned", complete: hasInventory },
    { key: "deployed", label: "Deployed", complete: isDeployed },
    { key: "revoked", label: "Revoked", complete: isRevoked },
  ]
}

function currentStepKey(steps: Step[]) {
  const revoked = steps.find((s) => s.key === "revoked")
  const deployed = steps.find((s) => s.key === "deployed")
  const inventory = steps.find((s) => s.key === "inventory")
  const verified = steps.find((s) => s.key === "verified")

  if (revoked?.complete) return "revoked"
  if (deployed?.complete) return "deployed"
  if (inventory?.complete) return "inventory"
  if (verified?.complete) return "verified"
  return "enrolled"
}

export default function GuardLifecycleProgress(props: GuardLifecycleProgressProps) {
  const steps = buildSteps(props)
  const activeKey = currentStepKey(steps)

  const activeLabel = steps.find((s) => s.key === activeKey)?.label ?? "Enrolled"

  return (
    <div className="mt-4 rounded-lg border bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Guard Lifecycle Progress</p>
        <p className="text-xs text-slate-600">
          Current stage: <span className="font-semibold text-slate-900">{activeLabel}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {steps.map((step, idx) => {
          const isActive = step.key === activeKey
          const isComplete = step.complete
          const dotClass = isComplete
            ? "bg-green-600 text-white border-green-600"
            : isActive
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white text-slate-500 border-slate-300"

          return (
            <div key={step.key} className="relative">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${dotClass}`}
                >
                  {idx + 1}
                </span>
                <span className={`text-xs font-medium ${isComplete || isActive ? "text-slate-900" : "text-slate-500"}`}>
                  {step.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 text-xs text-slate-600">
        Verification: {props.verificationVerified}/{props.verificationTotal} | Assigned inventory:{" "}
        {props.assignedInventoryCount} | Active deployments: {props.activeDeploymentsCount}
      </div>

      {props.currentDeployment ? (
        <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <span className="font-semibold">Current deployment:</span>{" "}
          {props.currentDeployment.clientName}
          {props.currentDeployment.branchName ? ` / ${props.currentDeployment.branchName}` : ""}
          {props.currentDeployment.shiftType ? ` | ${props.currentDeployment.shiftType}` : ""}
          {props.currentDeployment.designation ? ` | ${props.currentDeployment.designation}` : ""}
          {props.currentDeployment.deploymentDate ? ` | Since ${props.currentDeployment.deploymentDate}` : ""}
        </div>
      ) : props.latestEndedDeployment ? (
        <div className="mt-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800">
          <span className="font-semibold">Latest ended deployment:</span>{" "}
          {props.latestEndedDeployment.clientName}
          {props.latestEndedDeployment.branchName ? ` / ${props.latestEndedDeployment.branchName}` : ""}
          {props.latestEndedDeployment.endDate ? ` | Ended ${props.latestEndedDeployment.endDate}` : ""}
          {props.latestEndedDeployment.endReason ? ` | Reason: ${props.latestEndedDeployment.endReason}` : ""}
        </div>
      ) : null}
    </div>
  )
}
