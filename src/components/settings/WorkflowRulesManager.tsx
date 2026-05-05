"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, RotateCcw } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card"
import { Switch } from "@/components/shadcn/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs"
import { Button } from "@/components/shadcn/button"
import { Badge } from "@/components/shadcn/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog"
import { PermissionGate } from "@/components/shadcn/permission-gate"

type WorkflowRule = {
  key: string
  value: boolean
  defaultValue: boolean
  envOverrideKey: string
}

type WorkflowPreset = {
  id: string
  label: string
  description: string
}

type ApiPayload = {
  rules?: WorkflowRule[]
  presets?: WorkflowPreset[]
  activePresetId?: string | null
  message?: string
}

// Humanized descriptions per v1.1 design reference (Parwest /workflow-rules.html).
const RULE_DESCRIPTIONS: Record<string, string> = {
  "deployments.singleActivePerGuard":
    "One active deployment per guard at a time. Prevents overlapping assignments.",
  "deployments.blockInactiveUpdate":
    "Prevent editing ended deployments. Protects audit integrity.",
  "deployments.lockAfterEnd":
    "Lock deployment records once the end date has passed. Disabling allows back-editing of historical deployments.",
  "deployments.requireActiveGuardStatus":
    "Guard lifecycle must be ACTIVE before deployment is allowed.",
  "deployments.requireGuardOfficeConsistency":
    "Guard's assigned regional office must match the branch's region.",
  "deployments.requireEndDate":
    "An end date must be provided when ending a deployment.",
  "deployments.disallowEndDateBeforeDeploymentDate":
    "End date cannot precede the deployment start date.",
  "deployments.disallowFutureEndDate":
    "End date cannot be set in the future.",
  "deployments.requireBranchContract":
    "Branch must have an active contract before guards can be assigned.",
  "deployments.requireClientHasBranches":
    "Client must have at least one branch before deployment is allowed.",
  "deployments.requireVerifiedPrerequisites":
    "Guard must have all required prerequisites verified before deployment.",
  "inventoryDemand.requirePendingInitialStatus":
    "New inventory demands always start in PENDING status.",
  "inventoryDemand.enforceTransitionMap":
    "Only valid demand status transitions are permitted (e.g. PENDING→APPROVED).",
  "inventoryDemand.blockCoreEditsAfterTerminal":
    "Core demand fields cannot be edited after a terminal status. Disabling allows data tampering on closed records.",
  "inventoryDemand.requireSufficientStockForFulfillment":
    "Store must have sufficient stock before a demand can be fulfilled.",
  // Deductions policy
  "deductions.applyApsaaBranchRate":
    "Auto-apply APSAA at the client branch–wise approved rate every month.",
  "deductions.applyCwfRegionRate":
    "Auto-apply CWF at the region-wise approved rate every month.",
  "deductions.applyApsaaPunjabOnEnrollment":
    "When a guard is enrolled and deployed in Punjab, auto-seed the APSAA Punjab deduction.",
  "deductions.uniformAutoInstallments":
    "Issuing a jersey auto-creates installment deductions per the active uniform plan.",
  "deductions.uniformResignationRecovery":
    "Resignation auto-applies tenure-tier recovery (e.g. <3mo → Rs 5,000, 3–6mo → Rs 3,000) to final payroll.",
  "deductions.nightCallAutoDeduct":
    "Derive day-salary deductions from night-call logs per the active night-call rule.",
  "deductions.eobiAutoDeduct":
    "Auto-deduct EOBI monthly for guards with active EOBI enrollment, at the notified rate.",
  "deductions.essiAutoDeduct":
    "Auto-deduct ESSI monthly for guards with active ESSI enrollment, at the notified provincial rate.",
  "deductions.trainingSchoolFeesAutoInstallments":
    "Issuing a training course auto-creates monthly installment deductions for the tuition.",
  "deductions.absentAutoDeduct":
    "Emit an explicit ABSENT deduction line on each payroll, computed from verified attendance.",
  "deductions.advanceSalaryAutoRecover":
    "Apply scheduled advance-salary recoveries automatically on the matching payroll month.",
  "deductions.requireRateApprovalSeparation":
    "A rate row's proposer must differ from its approver (separation of duties).",
  "deductions.requireApprovalDocument":
    "A source approval document URL is required before a rate row can be activated.",
  "deductions.lockRetroactiveChanges":
    "Block backdated effectiveFrom on rate rows unless the user has DEDUCTIONS:RATE_RETROACTIVE.",
  "deductions.allowOverrideOnFinalized":
    "Allow per-payroll deduction line overrides even on finalized payrolls. Disabling forces unfinalize first.",
}

// Rules whose disable transition is destructive / non-reversible in effect.
const DESTRUCTIVE_RULES = new Set<string>([
  "deployments.lockAfterEnd",
  "deployments.blockInactiveUpdate",
  "inventoryDemand.blockCoreEditsAfterTerminal",
  "deductions.requireRateApprovalSeparation",
  "deductions.requireApprovalDocument",
  "deductions.lockRetroactiveChanges",
  "deductions.allowOverrideOnFinalized",
])

const DESTRUCTIVE_CONSEQUENCES: Record<string, string> = {
  "deployments.lockAfterEnd":
    "Disabling lockAfterEnd will allow editing of ended deployments. This may break audit trails on historical records.",
  "deployments.blockInactiveUpdate":
    "Disabling blockInactiveUpdate will allow modifications to ended/inactive deployments. This may compromise audit integrity.",
  "inventoryDemand.blockCoreEditsAfterTerminal":
    "Disabling blockCoreEditsAfterTerminal will allow tampering with core demand fields on closed records.",
  "deductions.requireRateApprovalSeparation":
    "Disabling separation-of-duties allows the same user to both propose and approve a rate change. This weakens financial controls.",
  "deductions.requireApprovalDocument":
    "Disabling will allow rates to be activated without a linked approval document — auditors will lose the paper trail.",
  "deductions.lockRetroactiveChanges":
    "Disabling allows any rate-editing user to backdate effectiveFrom and silently rewrite past payroll deductions.",
  "deductions.allowOverrideOnFinalized":
    "Enabling allows deduction line overrides on already-finalized payrolls. This bypasses the unfinalize → recompute → re-finalize flow.",
}

const MODULE_LABELS: Record<string, string> = {
  deployments: "Deployments",
  inventoryDemand: "Inventory Demand",
  deductions: "Deductions Policy",
}

function moduleOf(ruleKey: string): string {
  return ruleKey.split(".")[0] || "other"
}

function humanizeDescription(ruleKey: string): string {
  return RULE_DESCRIPTIONS[ruleKey] || "Workflow validation rule."
}

export default function WorkflowRulesManager() {
  const [rules, setRules] = useState<WorkflowRule[]>([])
  const [presets, setPresets] = useState<WorkflowPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>("")
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [applyingPreset, setApplyingPreset] = useState(false)
  const [pendingDisable, setPendingDisable] = useState<WorkflowRule | null>(null)

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) || null

  const loadRules = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/workflow-rules", { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as ApiPayload
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load workflow rules.")
      }
      setRules(Array.isArray(payload.rules) ? payload.rules : [])
      const nextPresets = Array.isArray(payload.presets) ? payload.presets : []
      setPresets(nextPresets)
      setActivePresetId(typeof payload.activePresetId === "string" ? payload.activePresetId : null)
      setSelectedPresetId((prev) => prev || nextPresets[0]?.id || "")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load workflow rules."
      setRules([])
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const persistToggle = useCallback(async (rule: WorkflowRule, nextValue: boolean) => {
    setSavingKey(rule.key)
    try {
      const response = await fetch("/api/workflow-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { [rule.key]: nextValue } }),
      })
      const payload = (await response.json().catch(() => ({}))) as ApiPayload
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to update workflow rule.")
      }
      setRules(Array.isArray(payload.rules) ? payload.rules : [])
      setActivePresetId(typeof payload.activePresetId === "string" ? payload.activePresetId : null)
      toast.success(`${rule.key} updated`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update workflow rule."
      toast.error(message)
    } finally {
      setSavingKey(null)
    }
  }, [])

  const handleToggle = useCallback(
    (rule: WorkflowRule, nextChecked: boolean) => {
      // Confirm only on the disable transition for destructive rules.
      if (!nextChecked && rule.value && DESTRUCTIVE_RULES.has(rule.key)) {
        setPendingDisable(rule)
        return
      }
      void persistToggle(rule, nextChecked)
    },
    [persistToggle]
  )

  const confirmDisable = useCallback(() => {
    if (!pendingDisable) return
    const rule = pendingDisable
    setPendingDisable(null)
    void persistToggle(rule, false)
  }, [pendingDisable, persistToggle])

  const resetToDefaults = async () => {
    const updates: Record<string, boolean> = {}
    rules.forEach((rule) => {
      updates[rule.key] = rule.defaultValue
    })
    try {
      const response = await fetch("/api/workflow-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })
      const payload = (await response.json().catch(() => ({}))) as ApiPayload
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to reset workflow rules.")
      }
      setRules(Array.isArray(payload.rules) ? payload.rules : [])
      setActivePresetId(typeof payload.activePresetId === "string" ? payload.activePresetId : null)
      toast.success("Workflow rules reset to defaults")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset workflow rules."
      toast.error(message)
    }
  }

  const applyPreset = async () => {
    if (!selectedPresetId) return
    setApplyingPreset(true)
    try {
      const response = await fetch("/api/workflow-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: selectedPresetId }),
      })
      const payload = (await response.json().catch(() => ({}))) as ApiPayload
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to apply workflow preset.")
      }
      setRules(Array.isArray(payload.rules) ? payload.rules : [])
      setActivePresetId(typeof payload.activePresetId === "string" ? payload.activePresetId : null)
      toast.success(`Preset ${selectedPresetId} applied`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply workflow preset."
      toast.error(message)
    } finally {
      setApplyingPreset(false)
    }
  }

  const groupedRules = useMemo(() => {
    const groups = new Map<string, WorkflowRule[]>()
    rules.forEach((rule) => {
      const mod = moduleOf(rule.key)
      const arr = groups.get(mod) || []
      arr.push(rule)
      groups.set(mod, arr)
    })
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: MODULE_LABELS[key] || key,
      items,
    }))
  }, [rules])

  const [activeTab, setActiveTab] = useState<string>("")
  useEffect(() => {
    if (!activeTab && groupedRules.length) {
      setActiveTab(groupedRules[0].key)
    }
  }, [groupedRules, activeTab])

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Workflow Rules"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Toggle workflow strictness without changing route code. Changes are persisted and applied immediately."}</p></div></div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Active configuration</CardTitle>
            <CardDescription>
              Active preset: <span className="font-mono">{activePresetId || "custom"}</span>
            </CardDescription>
          </div>
          <PermissionGate module="SETTINGS" action="UPDATE" mode="hide">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void loadRules()} disabled={loading}>
                <RefreshCw className="me-2 h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void resetToDefaults()}
                disabled={loading || !rules.length}
              >
                <RotateCcw className="me-2 h-3.5 w-3.5" />
                Reset Defaults
              </Button>
            </div>
          </PermissionGate>
        </CardHeader>
        <CardContent>
          <PermissionGate module="SETTINGS" action="UPDATE" mode="hide">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <label className="mb-1 block text-xs uppercase text-muted-foreground">Preset</label>
                <select
                  className="ui-select"
                  value={selectedPresetId}
                  onChange={(event) => setSelectedPresetId(event.target.value)}
                >
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                {selectedPreset?.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{selectedPreset.description}</p>
                ) : null}
              </div>
              <Button
                variant="secondary"
                onClick={() => void applyPreset()}
                disabled={!selectedPresetId || applyingPreset}
              >
                {applyingPreset ? (
                  <>
                    <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  "Apply Preset"
                )}
              </Button>
            </div>
          </PermissionGate>
        </CardContent>
      </Card>

      {!rules.length ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {loading ? "Loading workflow rules..." : "No workflow rules found."}
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {groupedRules.map((group) => (
              <TabsTrigger key={group.key} value={group.key}>
                {group.label}
                <span className="ms-2 text-xs text-muted-foreground">{group.items.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {groupedRules.map((group) => (
            <TabsContent key={group.key} value={group.key} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((rule) => {
                  const isDestructive = DESTRUCTIVE_RULES.has(rule.key)
                  const isSaving = savingKey === rule.key
                  return (
                    <Card key={rule.key} className={isDestructive ? "border-destructive/40" : ""}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <CardTitle className="font-mono text-sm">{rule.key}</CardTitle>
                            <CardDescription>{humanizeDescription(rule.key)}</CardDescription>
                          </div>
                          {isDestructive ? (
                            <Badge variant="destructive" className="shrink-0 gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Danger zone
                            </Badge>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <PermissionGate module="SETTINGS" action="UPDATE" mode="disable">
                              <Switch
                                checked={rule.value}
                                disabled={isSaving}
                                onCheckedChange={(checked) => handleToggle(rule, checked)}
                                aria-label={`Toggle ${rule.key}`}
                              />
                            </PermissionGate>
                            <span className="text-sm text-muted-foreground">
                              {rule.value ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Default: {rule.defaultValue ? "on" : "off"}
                          </span>
                        </div>
                        <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground">
                          ENV: {rule.envOverrideKey}
                        </p>
                      </CardContent>
                      <CardFooter className="justify-between text-xs text-muted-foreground">
                        {/* TODO: surface last-changed audit metadata once the workflow store records it */}
                        <span>Audit history available</span>
                        <Link
                          href={`/audit?module=SETTINGS&search=${encodeURIComponent(rule.key)}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Audit trail
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </CardFooter>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <AlertDialog open={!!pendingDisable} onOpenChange={(open) => !open && setPendingDisable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable danger-zone rule?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDisable
                ? DESTRUCTIVE_CONSEQUENCES[pendingDisable.key] ||
                  `Disabling ${pendingDisable.key} may have non-reversible effects.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep enabled</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disable Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
