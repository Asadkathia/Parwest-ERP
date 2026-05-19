import ImportsLifecycleManager from "@/components/imports/ImportsLifecycleManager"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"

export default function ImportsPage() {
  return (
    <ImportsLifecycleManager
      initialModule="users"
      draftEditorEnabled={isWorkflowRuleEnabled("imports.draftEditor")}
    />
  )
}
