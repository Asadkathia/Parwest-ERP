import { readWorkflowRuleOverridesSync } from "@/lib/workflows/store"

export type WorkflowRuleKey =
  | "deployments.singleActivePerGuard"
  | "deployments.blockInactiveUpdate"
  | "deployments.lockAfterEnd"
  | "deployments.requireActiveGuardStatus"
  | "deployments.requireGuardOfficeConsistency"
  | "deployments.requireEndDate"
  | "deployments.disallowEndDateBeforeDeploymentDate"
  | "deployments.disallowFutureEndDate"
  | "deployments.requireBranchContract"
  | "deployments.requireClientHasBranches"
  | "inventoryDemand.requirePendingInitialStatus"
  | "inventoryDemand.enforceTransitionMap"
  | "inventoryDemand.blockCoreEditsAfterTerminal"
  | "inventoryDemand.requireSufficientStockForFulfillment"

export type WorkflowRuleConfig = Record<WorkflowRuleKey, boolean>
export type WorkflowPresetId = "balanced" | "strict" | "relaxed"

export type WorkflowPreset = {
  id: WorkflowPresetId
  label: string
  description: string
  rules: WorkflowRuleConfig
}

// Central workflow policy map.
// To loosen/tighten workflow behavior later, change values here
// (or override using WORKFLOW_RULE_* env vars).
const BASE_WORKFLOW_RULES: WorkflowRuleConfig = {
  "deployments.singleActivePerGuard": true,
  "deployments.blockInactiveUpdate": true,
  "deployments.lockAfterEnd": true,
  "deployments.requireActiveGuardStatus": true,
  "deployments.requireGuardOfficeConsistency": false,
  "deployments.requireEndDate": true,
  "deployments.disallowEndDateBeforeDeploymentDate": true,
  "deployments.disallowFutureEndDate": true,
  "deployments.requireBranchContract": true,
  "deployments.requireClientHasBranches": true,
  "inventoryDemand.requirePendingInitialStatus": true,
  "inventoryDemand.enforceTransitionMap": true,
  "inventoryDemand.blockCoreEditsAfterTerminal": true,
  "inventoryDemand.requireSufficientStockForFulfillment": true,
}

export const WORKFLOW_PRESETS: Record<WorkflowPresetId, WorkflowPreset> = {
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "Recommended default for normal operations.",
    rules: { ...BASE_WORKFLOW_RULES },
  },
  strict: {
    id: "strict",
    label: "Strict",
    description: "Maximize guardrails and validation for controlled operations.",
    rules: {
      ...BASE_WORKFLOW_RULES,
      "deployments.requireGuardOfficeConsistency": true,
    },
  },
  relaxed: {
    id: "relaxed",
    label: "Relaxed",
    description: "Looser constraints for iterative development and custom workflows.",
    rules: {
      ...BASE_WORKFLOW_RULES,
      "deployments.singleActivePerGuard": false,
      "deployments.blockInactiveUpdate": false,
      "deployments.lockAfterEnd": false,
      "deployments.requireActiveGuardStatus": false,
      "deployments.requireGuardOfficeConsistency": false,
      "deployments.requireEndDate": false,
      "deployments.disallowEndDateBeforeDeploymentDate": false,
      "deployments.disallowFutureEndDate": false,
      "deployments.requireBranchContract": false,
      "deployments.requireClientHasBranches": false,
      "inventoryDemand.requirePendingInitialStatus": false,
      "inventoryDemand.enforceTransitionMap": false,
      "inventoryDemand.blockCoreEditsAfterTerminal": false,
      "inventoryDemand.requireSufficientStockForFulfillment": false,
    },
  },
}

export const WORKFLOW_PRESET_ENV_KEY = "WORKFLOW_RULE_PRESET"

export const ENV_OVERRIDE_KEYS: Record<WorkflowRuleKey, string> = {
  "deployments.singleActivePerGuard": "WORKFLOW_RULE_DEPLOYMENTS_SINGLE_ACTIVE_PER_GUARD",
  "deployments.blockInactiveUpdate": "WORKFLOW_RULE_DEPLOYMENTS_BLOCK_INACTIVE_UPDATE",
  "deployments.lockAfterEnd": "WORKFLOW_RULE_DEPLOYMENTS_LOCK_AFTER_END",
  "deployments.requireActiveGuardStatus": "WORKFLOW_RULE_DEPLOYMENTS_REQUIRE_ACTIVE_GUARD_STATUS",
  "deployments.requireGuardOfficeConsistency": "WORKFLOW_RULE_DEPLOYMENTS_REQUIRE_GUARD_OFFICE_CONSISTENCY",
  "deployments.requireEndDate": "WORKFLOW_RULE_DEPLOYMENTS_REQUIRE_END_DATE",
  "deployments.disallowEndDateBeforeDeploymentDate":
    "WORKFLOW_RULE_DEPLOYMENTS_DISALLOW_ENDDATE_BEFORE_DEPLOYMENTDATE",
  "deployments.disallowFutureEndDate": "WORKFLOW_RULE_DEPLOYMENTS_DISALLOW_FUTURE_ENDDATE",
  "deployments.requireBranchContract": "WORKFLOW_RULE_DEPLOYMENTS_REQUIRE_BRANCH_CONTRACT",
  "deployments.requireClientHasBranches": "WORKFLOW_RULE_DEPLOYMENTS_REQUIRE_CLIENT_HAS_BRANCHES",
  "inventoryDemand.requirePendingInitialStatus": "WORKFLOW_RULE_INVENTORY_DEMAND_REQUIRE_PENDING_INITIAL_STATUS",
  "inventoryDemand.enforceTransitionMap": "WORKFLOW_RULE_INVENTORY_DEMAND_ENFORCE_TRANSITION_MAP",
  "inventoryDemand.blockCoreEditsAfterTerminal":
    "WORKFLOW_RULE_INVENTORY_DEMAND_BLOCK_CORE_EDITS_AFTER_TERMINAL",
  "inventoryDemand.requireSufficientStockForFulfillment":
    "WORKFLOW_RULE_INVENTORY_DEMAND_REQUIRE_SUFFICIENT_STOCK_FOR_FULFILLMENT",
}

function toWorkflowPresetId(value: string | undefined): WorkflowPresetId | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === "balanced" || normalized === "strict" || normalized === "relaxed") {
    return normalized
  }
  return null
}

function parseBooleanOverride(raw: string | undefined): boolean | null {
  if (raw == null) return null
  const normalized = raw.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) return true
  if (["0", "false", "no", "off"].includes(normalized)) return false
  return null
}

export function getWorkflowRuleKeys(): WorkflowRuleKey[] {
  return Object.keys(BASE_WORKFLOW_RULES) as WorkflowRuleKey[]
}

export function getWorkflowPresets(): WorkflowPreset[] {
  return Object.values(WORKFLOW_PRESETS).map((preset) => ({
    ...preset,
    rules: { ...preset.rules },
  }))
}

export function getWorkflowPresetById(presetId: string): WorkflowPreset | null {
  const resolved = toWorkflowPresetId(presetId)
  if (!resolved) return null
  return WORKFLOW_PRESETS[resolved]
}

export function getDefaultWorkflowRules(): WorkflowRuleConfig {
  const presetId = toWorkflowPresetId(process.env[WORKFLOW_PRESET_ENV_KEY]) || "balanced"
  return { ...WORKFLOW_PRESETS[presetId].rules }
}

export function resolveWorkflowPresetId(config: WorkflowRuleConfig): WorkflowPresetId | null {
  const keys = getWorkflowRuleKeys()
  for (const preset of Object.values(WORKFLOW_PRESETS)) {
    const matched = keys.every((key) => config[key] === preset.rules[key])
    if (matched) return preset.id
  }
  return null
}

function buildWorkflowRuleConfig(): WorkflowRuleConfig {
  const next = getDefaultWorkflowRules()
  getWorkflowRuleKeys().forEach((ruleKey) => {
    const override = parseBooleanOverride(process.env[ENV_OVERRIDE_KEYS[ruleKey]])
    if (override !== null) {
      next[ruleKey] = override
    }
  })
  const fileOverrides = readWorkflowRuleOverridesSync()
  getWorkflowRuleKeys().forEach((ruleKey) => {
    if (typeof fileOverrides[ruleKey] === "boolean") {
      next[ruleKey] = fileOverrides[ruleKey] as boolean
    }
  })
  return next
}

export function isWorkflowRuleEnabled(ruleKey: WorkflowRuleKey): boolean {
  return buildWorkflowRuleConfig()[ruleKey]
}

export function getWorkflowRuleSnapshot(): WorkflowRuleConfig {
  return buildWorkflowRuleConfig()
}
