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
