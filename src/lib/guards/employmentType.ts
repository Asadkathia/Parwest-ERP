import { prisma } from "@/lib/db"

export type PreviousEmploymentEntry = {
  type?: string
  isExService?: boolean
  rank?: string
  registrationNo?: string
  unit?: string
}

export type EmploymentTypeValidation =
  | { ok: true; exServiceType: string; isExService: boolean }
  | { ok: false; message: string }

async function activeExServiceTypeNames(): Promise<string[]> {
  try {
    const rows = await (prisma.guardExServiceType as unknown as {
      findMany: (args: unknown) => Promise<Array<{ name: string }>>
    }).findMany({ where: { isActive: true }, select: { name: true } })
    return rows.map((r) => r.name)
  } catch {
    return ["ARMY", "POLICE", "RANGERS", "MUJAHID"]
  }
}

/**
 * Validate the guard-employment-type contract for create/update payloads:
 *   - exServiceType must be "CIVILIAN" or an active ex-service type name.
 *   - When non-civilian, previousEmployments must include ≥1 row of that type
 *     with registrationNo, rank, and unit populated.
 *   - Every previous-employment row must have a non-empty `type`.
 */
export async function validateGuardEmploymentType(
  rawType: unknown,
  rows: PreviousEmploymentEntry[]
): Promise<EmploymentTypeValidation> {
  const exServiceType = String(rawType ?? "").trim()
  if (!exServiceType) {
    return { ok: false, message: "Guard Employment Type is required." }
  }

  const allowed = new Set<string>(["CIVILIAN", ...(await activeExServiceTypeNames())])
  if (!allowed.has(exServiceType)) {
    return { ok: false, message: `Invalid Guard Employment Type "${exServiceType}".` }
  }

  if (rows.some((r) => !String(r.type ?? "").trim())) {
    return {
      ok: false,
      message: "Each previous employment record must have an Employment Type selected.",
    }
  }

  if (exServiceType !== "CIVILIAN") {
    const matching = rows.filter((r) => r.type === exServiceType)
    if (matching.length === 0) {
      return {
        ok: false,
        message: `At least one previous employment record with type ${exServiceType} is required.`,
      }
    }
    const incomplete = matching.find(
      (r) =>
        !String(r.registrationNo ?? "").trim() ||
        !String(r.rank ?? "").trim() ||
        !String(r.unit ?? "").trim()
    )
    if (incomplete) {
      return {
        ok: false,
        message: `${exServiceType} employment record requires Registration No, Rank, and Unit.`,
      }
    }
  }

  return { ok: true, exServiceType, isExService: exServiceType !== "CIVILIAN" }
}

/** Set of ex-service type names treated as "ex-service" by the fallback path. */
const KNOWN_EX_SERVICE = new Set(["ARMY", "POLICE", "RANGERS", "MUJAHID", "OTHER"])

export type ResolveExServiceInput = {
  /** Explicit `exServiceType` sent by the client (new field). May be empty. */
  explicitType?: unknown
  /** Parsed previousEmployments rows. */
  rows: PreviousEmploymentEntry[]
  /**
   * Legacy `isExService` flag (string "true"/"false" or boolean) used ONLY by
   * the fallback branch when there are no previousEmployments rows. Ignored
   * when an explicit type is present.
   */
  legacyIsExService?: unknown
}

export type ResolveExServiceResult =
  | { ok: true; exServiceType: string; isExService: boolean }
  | { ok: false; message: string }

/**
 * Single source of truth for deriving `(exServiceType, isExService)` from a
 * create/update payload — covering BOTH the explicit branch (an authoritative
 * client-supplied `exServiceType`, validated via `validateGuardEmploymentType`)
 * and the fallback branch (derive from previousEmployments rows, or the legacy
 * `isExService` flag when there are no rows).
 *
 * Used by POST /api/guards AND PUT /api/guards/[id] so the two routes can no
 * longer diverge on the null-vs-"CIVILIAN" question: the fallback ALWAYS lands
 * on a concrete string (`"CIVILIAN"` default), never `null`, matching what
 * downstream consumers (payroll rate lookup, deployment-rate `exService`
 * filter) expect.
 */
export async function resolveExServiceType(
  input: ResolveExServiceInput,
): Promise<ResolveExServiceResult> {
  const explicit = String(input.explicitType ?? "").trim()
  if (explicit) {
    return validateGuardEmploymentType(explicit, input.rows)
  }

  // Fallback (legacy clients that don't send the new field).
  const rows = input.rows ?? []
  if (rows.length > 0) {
    const primary = rows.find((e) => e.isExService === true) ?? rows[0]
    const derivedType = String(primary?.type ?? "").trim().toUpperCase()
    const exServiceType = derivedType && derivedType !== "CIVILIAN" ? derivedType : "CIVILIAN"
    const isExService = rows.some((e) => e.isExService === true) || KNOWN_EX_SERVICE.has(exServiceType)
    return {
      ok: true,
      exServiceType: isExService ? exServiceType : "CIVILIAN",
      isExService,
    }
  }

  // No rows — honour the legacy boolean flag, defaulting to CIVILIAN.
  const isExService = input.legacyIsExService === true || input.legacyIsExService === "true"
  return { ok: true, exServiceType: "CIVILIAN", isExService }
}
