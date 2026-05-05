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
  | "deployments.requireVerifiedPrerequisites"
  | "deployments.allowExtraType"
  | "branches.requireInactiveBranchesBeforeClientInactive"
  | "branches.blockInactiveWithActiveDeployment"
  | "inventoryDemand.requirePendingInitialStatus"
  | "inventoryDemand.enforceTransitionMap"
  | "inventoryDemand.blockCoreEditsAfterTerminal"
  | "inventoryDemand.requireSufficientStockForFulfillment"
  | "invoicing.autoAccrualEnabled"
  | "invoicing.draftReminderEnabled"
  // ----- Deductions policy (Wave 3) -----
  | "deductions.applyApsaaBranchRate"
  | "deductions.applyCwfRegionRate"
  | "deductions.applyApsaaPunjabOnEnrollment"
  | "deductions.uniformAutoInstallments"
  | "deductions.uniformResignationRecovery"
  | "deductions.nightCallAutoDeduct"
  | "deductions.eobiAutoDeduct"
  | "deductions.essiAutoDeduct"
  | "deductions.trainingSchoolFeesAutoInstallments"
  | "deductions.absentAutoDeduct"
  | "deductions.advanceSalaryAutoRecover"
  | "deductions.requireRateApprovalSeparation"
  | "deductions.requireApprovalDocument"
  | "deductions.lockRetroactiveChanges"
  | "deductions.allowOverrideOnFinalized"

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
  "deployments.requireVerifiedPrerequisites": true,
  "deployments.allowExtraType": true,
  "branches.requireInactiveBranchesBeforeClientInactive": true,
  // Mirrors the client→branch cascade: a branch with active deployments cannot
  // be deactivated until those deployments are revoked (Ticket 32). Together
  // with `requireInactiveBranchesBeforeClientInactive` this enforces the full
  // cascade: revoke deployments → INACTIVE branch → INACTIVE client.
  "branches.blockInactiveWithActiveDeployment": true,
  "inventoryDemand.requirePendingInitialStatus": true,
  "inventoryDemand.enforceTransitionMap": true,
  "inventoryDemand.blockCoreEditsAfterTerminal": true,
  "inventoryDemand.requireSufficientStockForFulfillment": true,
  "invoicing.autoAccrualEnabled": true,
  "invoicing.draftReminderEnabled": true,
  // Deductions policy — all canonical automations enabled by default.
  // Disable via /settings/workflow-rules or env vars to fall back to manual entry.
  "deductions.applyApsaaBranchRate": true,
  "deductions.applyCwfRegionRate": true,
  "deductions.applyApsaaPunjabOnEnrollment": true,
  "deductions.uniformAutoInstallments": true,
  "deductions.uniformResignationRecovery": true,
  "deductions.nightCallAutoDeduct": true,
  "deductions.eobiAutoDeduct": true,
  "deductions.essiAutoDeduct": true,
  "deductions.trainingSchoolFeesAutoInstallments": true,
  "deductions.absentAutoDeduct": true,
  "deductions.advanceSalaryAutoRecover": true,
  "deductions.requireRateApprovalSeparation": true,
  "deductions.requireApprovalDocument": true,
  "deductions.lockRetroactiveChanges": true,
  // Overrides on finalized payrolls require explicit unfinalize first.
  "deductions.allowOverrideOnFinalized": false,
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
      "deployments.requireVerifiedPrerequisites": false,
      "deployments.allowExtraType": true,
      "branches.requireInactiveBranchesBeforeClientInactive": false,
      "branches.blockInactiveWithActiveDeployment": false,
      "inventoryDemand.requirePendingInitialStatus": false,
      "inventoryDemand.enforceTransitionMap": false,
      "inventoryDemand.blockCoreEditsAfterTerminal": false,
      "inventoryDemand.requireSufficientStockForFulfillment": false,
      "invoicing.autoAccrualEnabled": false,
      "invoicing.draftReminderEnabled": false,
      // Relaxed mode: turn off all deduction automations + dual-control. Manual entry only.
      "deductions.applyApsaaBranchRate": false,
      "deductions.applyCwfRegionRate": false,
      "deductions.applyApsaaPunjabOnEnrollment": false,
      "deductions.uniformAutoInstallments": false,
      "deductions.uniformResignationRecovery": false,
      "deductions.nightCallAutoDeduct": false,
      "deductions.eobiAutoDeduct": false,
      "deductions.essiAutoDeduct": false,
      "deductions.trainingSchoolFeesAutoInstallments": false,
      "deductions.absentAutoDeduct": false,
      "deductions.advanceSalaryAutoRecover": false,
      "deductions.requireRateApprovalSeparation": false,
      "deductions.requireApprovalDocument": false,
      "deductions.lockRetroactiveChanges": false,
      "deductions.allowOverrideOnFinalized": true,
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
  "deployments.requireVerifiedPrerequisites": "WORKFLOW_RULE_DEPLOYMENTS_REQUIRE_VERIFIED_PREREQUISITES",
  "deployments.allowExtraType": "WORKFLOW_RULE_DEPLOYMENTS_ALLOW_EXTRA_TYPE",
  "branches.requireInactiveBranchesBeforeClientInactive":
    "WORKFLOW_RULE_BRANCHES_REQUIRE_INACTIVE_BRANCHES_BEFORE_CLIENT_INACTIVE",
  "branches.blockInactiveWithActiveDeployment":
    "WORKFLOW_RULE_BRANCHES_BLOCK_INACTIVE_WITH_ACTIVE_DEPLOYMENT",
  "inventoryDemand.requirePendingInitialStatus": "WORKFLOW_RULE_INVENTORY_DEMAND_REQUIRE_PENDING_INITIAL_STATUS",
  "inventoryDemand.enforceTransitionMap": "WORKFLOW_RULE_INVENTORY_DEMAND_ENFORCE_TRANSITION_MAP",
  "inventoryDemand.blockCoreEditsAfterTerminal":
    "WORKFLOW_RULE_INVENTORY_DEMAND_BLOCK_CORE_EDITS_AFTER_TERMINAL",
  "inventoryDemand.requireSufficientStockForFulfillment":
    "WORKFLOW_RULE_INVENTORY_DEMAND_REQUIRE_SUFFICIENT_STOCK_FOR_FULFILLMENT",
  "invoicing.autoAccrualEnabled": "WORKFLOW_RULE_INVOICING_AUTO_ACCRUAL_ENABLED",
  "invoicing.draftReminderEnabled": "WORKFLOW_RULE_INVOICING_DRAFT_REMINDER_ENABLED",
  "deductions.applyApsaaBranchRate": "WORKFLOW_RULE_DEDUCTIONS_APPLY_APSAA_BRANCH_RATE",
  "deductions.applyCwfRegionRate": "WORKFLOW_RULE_DEDUCTIONS_APPLY_CWF_REGION_RATE",
  "deductions.applyApsaaPunjabOnEnrollment":
    "WORKFLOW_RULE_DEDUCTIONS_APPLY_APSAA_PUNJAB_ON_ENROLLMENT",
  "deductions.uniformAutoInstallments": "WORKFLOW_RULE_DEDUCTIONS_UNIFORM_AUTO_INSTALLMENTS",
  "deductions.uniformResignationRecovery":
    "WORKFLOW_RULE_DEDUCTIONS_UNIFORM_RESIGNATION_RECOVERY",
  "deductions.nightCallAutoDeduct": "WORKFLOW_RULE_DEDUCTIONS_NIGHT_CALL_AUTO_DEDUCT",
  "deductions.eobiAutoDeduct": "WORKFLOW_RULE_DEDUCTIONS_EOBI_AUTO_DEDUCT",
  "deductions.essiAutoDeduct": "WORKFLOW_RULE_DEDUCTIONS_ESSI_AUTO_DEDUCT",
  "deductions.trainingSchoolFeesAutoInstallments":
    "WORKFLOW_RULE_DEDUCTIONS_TRAINING_SCHOOL_FEES_AUTO_INSTALLMENTS",
  "deductions.absentAutoDeduct": "WORKFLOW_RULE_DEDUCTIONS_ABSENT_AUTO_DEDUCT",
  "deductions.advanceSalaryAutoRecover":
    "WORKFLOW_RULE_DEDUCTIONS_ADVANCE_SALARY_AUTO_RECOVER",
  "deductions.requireRateApprovalSeparation":
    "WORKFLOW_RULE_DEDUCTIONS_REQUIRE_RATE_APPROVAL_SEPARATION",
  "deductions.requireApprovalDocument":
    "WORKFLOW_RULE_DEDUCTIONS_REQUIRE_APPROVAL_DOCUMENT",
  "deductions.lockRetroactiveChanges":
    "WORKFLOW_RULE_DEDUCTIONS_LOCK_RETROACTIVE_CHANGES",
  "deductions.allowOverrideOnFinalized":
    "WORKFLOW_RULE_DEDUCTIONS_ALLOW_OVERRIDE_ON_FINALIZED",
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
