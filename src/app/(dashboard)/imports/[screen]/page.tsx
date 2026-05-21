import { notFound } from "next/navigation"
import ImportsLifecycleManager from "@/components/imports/ImportsLifecycleManager"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"

export default async function ImportScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const supported = ["users", "guards", "clients", "inventory", "loans"]

  if (!supported.includes(screen)) {
    notFound()
  }

  return (
    <ImportsLifecycleManager
      initialModule={screen as "users" | "guards" | "clients" | "inventory" | "loans"}
      draftEditorEnabled={isWorkflowRuleEnabled("imports.draftEditor")}
    />
  )
}
