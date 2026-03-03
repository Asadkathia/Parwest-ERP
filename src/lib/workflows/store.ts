import { existsSync, readFileSync } from "fs"
import { promises as fs } from "fs"
import path from "path"
import type { WorkflowRuleKey } from "@/lib/workflows/policy"

type WorkflowRuleOverrides = Partial<Record<WorkflowRuleKey, boolean>>

const DATA_DIR = path.join(process.cwd(), "data")
const STORE_FILE = path.join(DATA_DIR, "workflow-rules.json")

function normalizeOverrides(input: unknown): WorkflowRuleOverrides {
  if (!input || typeof input !== "object") return {}
  const out: WorkflowRuleOverrides = {}
  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      out[key as WorkflowRuleKey] = value
    }
  })
  return out
}

export function readWorkflowRuleOverridesSync(): WorkflowRuleOverrides {
  if (!existsSync(STORE_FILE)) return {}
  try {
    const raw = readFileSync(STORE_FILE, "utf8")
    return normalizeOverrides(JSON.parse(raw))
  } catch {
    return {}
  }
}

export async function readWorkflowRuleOverrides(): Promise<WorkflowRuleOverrides> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const raw = await fs.readFile(STORE_FILE, "utf8")
    return normalizeOverrides(JSON.parse(raw))
  } catch {
    return {}
  }
}

export async function writeWorkflowRuleOverrides(overrides: WorkflowRuleOverrides) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(STORE_FILE, JSON.stringify(normalizeOverrides(overrides), null, 2), "utf8")
}
