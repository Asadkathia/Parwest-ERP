/**
 * Shared Parwest ID generator.
 *
 * Single source of truth used by `POST /api/guards` (single create) and
 * the bulk-import persist function. Past bug: when no regional-office
 * series was supplied, the generator used
 *   `findFirst({ where: { parwestId: { startsWith: "PW-" } }, orderBy: desc })`
 * which lexically matched RO-prefixed IDs (e.g. `PW-K-39995`) — letters
 * sort above digits in ASCII. The regex extractor (`^PW-\d+$`) then
 * failed, `maxNumber` stayed at 0, and every subsequent generation tried
 * `PW-00001` → P2002 collision after the first row.
 *
 * Fix: filter candidates at the DB layer with a Postgres regex match
 * (`~`) so we only consider parwestIds that genuinely fit the target
 * pattern. This eliminates the cross-prefix interference completely and
 * still uses a single ordered query (no `findMany` scan).
 */

import type { Prisma, PrismaClient } from "@prisma/client"

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Generates the next available `parwestId` for the given office series.
 *
 *   officeSeriesCode = "K"  → looks for `PW-K-NNNNN` (max), returns next.
 *   officeSeriesCode = null → looks for `PW-NNNNN`   (max), returns next.
 *
 * Returned IDs are always zero-padded to 5 digits. Throws on DB errors
 * but never silently collides — caller can decide whether to retry on
 * P2002 (rare race when two generators run concurrently against the
 * same prefix; in practice every caller of this fn awaits the insert
 * before generating the next id).
 */
export async function generateNextParwestId(
  db: Db,
  officeSeriesCode: string | null,
): Promise<string> {
  const prefix = officeSeriesCode ? `PW-${officeSeriesCode}` : "PW"
  // Postgres regex: `^PW-[0-9]+$` for null series, `^PW-K-[0-9]+$` etc.
  // We escape the office series defensively even though we expect it to
  // be a short letter code — better safe than parser-shaken.
  const escapedSeries = officeSeriesCode
    ? officeSeriesCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    : null
  const pgRegex = escapedSeries ? `^PW-${escapedSeries}-[0-9]+$` : `^PW-[0-9]+$`

  // $queryRaw returns whatever the SELECT yields. We pull the lexical
  // maximum (zero-padded numerics sort numerically when padding is fixed)
  // and parse the trailing digit run.
  const rows = await db.$queryRaw<Array<{ parwestId: string }>>`
    SELECT "parwestId"
    FROM "Guard"
    WHERE "parwestId" ~ ${pgRegex}
    ORDER BY "parwestId" DESC
    LIMIT 1
  `

  let maxNumber = 0
  if (rows.length > 0) {
    const tail = rows[0].parwestId.match(/(\d+)$/)
    if (tail) {
      const n = Number(tail[1])
      if (Number.isFinite(n)) maxNumber = n
    }
  }
  return `${prefix}-${String(maxNumber + 1).padStart(5, "0")}`
}
