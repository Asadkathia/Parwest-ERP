import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import {
  ENV_OVERRIDE_KEYS,
  getDefaultWorkflowRules,
  getWorkflowPresetById,
  getWorkflowPresets,
  getWorkflowRuleKeys,
  getWorkflowRuleSnapshot,
  resolveWorkflowPresetId,
} from "@/lib/workflows/policy"
// TODO(durability): workflow-rule persistence currently goes through the
// flat-file store in `src/lib/workflows/store.ts` (writes to
// `process.cwd()/data/workflow-rules.json`). On Vercel serverless this is
// non-durable across deploys/cold starts. Migrate to a Prisma-backed
// settings table during the schema-migration pass — see audit
// `docs/audits/settings-dead-legacy-conflict-audit.md` section C.
import { readWorkflowRuleOverrides, writeWorkflowRuleOverrides } from "@/lib/workflows/store"
import type { WorkflowRuleKey } from "@/lib/workflows/policy"

type WorkflowRuleApiRow = {
  key: string
  value: boolean
  defaultValue: boolean
  envOverrideKey: string
}

function buildRows(): WorkflowRuleApiRow[] {
  const defaults = getDefaultWorkflowRules()
  const merged = getWorkflowRuleSnapshot()
  return getWorkflowRuleKeys().map((key) => ({
    key,
    value: merged[key],
    defaultValue: defaults[key],
    envOverrideKey: ENV_OVERRIDE_KEYS[key],
  }))
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "SETTINGS", "VIEW")) return forbidden()

    const overrides = await readWorkflowRuleOverrides()
    const snapshot = getWorkflowRuleSnapshot()
    return ok({
      rules: buildRows(),
      overrides,
      presets: getWorkflowPresets().map((preset) => ({
        id: preset.id,
        label: preset.label,
        description: preset.description,
      })),
      activePresetId: resolveWorkflowPresetId(snapshot),
    })
  } catch (error) {
    console.error("Error loading workflow rules:", error)
    return internalServerError("Failed to load workflow rules.")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "SETTINGS", "UPDATE")) return forbidden()

    const body = await request.json().catch(() => null)
    const presetIdRaw = typeof body?.presetId === "string" ? body.presetId : null
    const updates = body?.updates
    if ((!updates || typeof updates !== "object") && !presetIdRaw) {
      return badRequest("Either presetId or updates object is required.")
    }

    const validKeys = new Set(getWorkflowRuleKeys())
    const currentOverrides = await readWorkflowRuleOverrides()
    const nextOverrides = { ...currentOverrides }

    if (presetIdRaw) {
      const preset = getWorkflowPresetById(presetIdRaw)
      if (!preset) {
        return badRequest(`Unknown workflow preset: ${presetIdRaw}`)
      }
      getWorkflowRuleKeys().forEach((ruleKey) => {
        nextOverrides[ruleKey] = preset.rules[ruleKey]
      })
    }

    if (updates && typeof updates === "object") {
      for (const [rawKey, rawValue] of Object.entries(updates as Record<string, unknown>)) {
        if (!validKeys.has(rawKey as WorkflowRuleKey)) {
          return badRequest(`Unknown workflow rule: ${rawKey}`)
        }
        if (typeof rawValue !== "boolean") {
          return badRequest(`workflow rule ${rawKey} must be boolean.`)
        }
        nextOverrides[rawKey as keyof typeof nextOverrides] = rawValue
      }
    }

    await writeWorkflowRuleOverrides(nextOverrides)
    const snapshot = getWorkflowRuleSnapshot()

    return ok({
      rules: buildRows(),
      overrides: nextOverrides,
      presets: getWorkflowPresets().map((preset) => ({
        id: preset.id,
        label: preset.label,
        description: preset.description,
      })),
      activePresetId: resolveWorkflowPresetId(snapshot),
    })
  } catch (error) {
    console.error("Error updating workflow rules:", error)
    return internalServerError("Failed to update workflow rules.")
  }
}
