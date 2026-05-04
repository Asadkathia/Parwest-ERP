import type { ReportDefinition } from "./types"

const definitions: ReportDefinition[] = []
let loaded = false

export function registerReport(def: ReportDefinition) {
  if (definitions.some((d) => d.key === def.key)) {
    throw new Error(`Duplicate report key: ${def.key}`)
  }
  definitions.push(def)
}

async function ensureLoaded() {
  if (loaded) return
  // Side-effect import — each definition file calls registerReport().
  await import("./definitions")
  loaded = true
}

export async function getAllReports(): Promise<ReportDefinition[]> {
  await ensureLoaded()
  return [...definitions]
}

export async function getReport(
  key: string
): Promise<ReportDefinition | undefined> {
  await ensureLoaded()
  return definitions.find((d) => d.key === key)
}
