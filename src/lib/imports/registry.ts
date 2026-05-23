/**
 * Bulk Import Registry — runtime singleton.
 *
 * Modules call `registerImport(definition)` at module-load time (via the
 * registry barrel `definitions/index.ts`). The engine resolves a definition
 * by `(module, subModule?)` tuple. Sub-modules are addressed by their key;
 * `subModule === undefined` means "the module's default top-level import".
 */

import type { BulkImportDefinition, BulkImportSummary, ImportModuleKey } from "./types"

const registry = new Map<string, BulkImportDefinition>()

function makeKey(module: ImportModuleKey, subModule?: string) {
  return subModule ? `${module}::${subModule}` : module
}

export function registerImport<T>(definition: BulkImportDefinition<T>) {
  const key = makeKey(definition.module, definition.subModule)
  if (registry.has(key)) {
    // Replace silently in dev (HMR) — warn but don't throw.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[bulk-imports] redefining ${key}`)
    }
  }
  registry.set(key, definition as BulkImportDefinition)
}

export function getImportDefinition(
  module: ImportModuleKey,
  subModule?: string,
): BulkImportDefinition | null {
  return registry.get(makeKey(module, subModule)) ?? null
}

export function listImportSummaries(module?: ImportModuleKey): BulkImportSummary[] {
  return [...registry.values()]
    .filter((d) => !module || d.module === module)
    .map((d) => ({
      module: d.module,
      subModule: d.subModule,
      label: d.label,
      description: d.description,
      requiredHeaders: d.requiredHeaders,
      optionalHeaders: d.optionalHeaders,
    }))
    .sort((a, b) => {
      if (a.module !== b.module) return a.module.localeCompare(b.module)
      if (!a.subModule) return -1
      if (!b.subModule) return 1
      return a.subModule.localeCompare(b.subModule)
    })
}

/**
 * Test-only — clears the registry. Production code never calls this.
 */
export function __resetRegistryForTests() {
  registry.clear()
}
