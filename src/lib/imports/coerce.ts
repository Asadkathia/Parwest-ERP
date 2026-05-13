/**
 * Bulk-import cell coercion helpers.
 *
 * Sources of "messy values" we have to tolerate:
 *   - Excel cells: native `Date`, native `number`, or strings the user typed.
 *   - exceljs parser: sometimes returns JS Date strings
 *     ("Mon Jan 01 2024 05:00:00 GMT+0500"), sometimes ISO, sometimes
 *     dd-mm-yyyy from the team's template.
 *   - Excel serial dates: integers ≈ days since 1899-12-30.
 *   - Placeholder strings the ERP team's bulk sheets use literally
 *     ("BULK", "Nil", "N/A", "-") which mean "no value".
 *
 * Every helper returns `null` for empty / sentinel / unparseable input so
 * downstream zod schemas can declare fields as `.nullable().optional()`
 * without needing per-field cleanup.
 */

const SENTINEL_TOKENS = new Set(["", "bulk", "nil", "n/a", "na", "-", "—", "none", "null"])

/**
 * Returns true when the supplied value is empty or a known sentinel
 * placeholder the team's templates use to mean "no value".
 */
export function isSentinel(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") {
    return SENTINEL_TOKENS.has(value.trim().toLowerCase())
  }
  return false
}

/**
 * Returns a trimmed string, or null when the value is empty/sentinel.
 * `keepSentinels: true` preserves placeholder strings literally (useful for
 * audit-style columns where the team explicitly wrote "BULK" and we want
 * to round-trip it). Default behaviour treats them as empty.
 */
export function coerceString(value: unknown, opts?: { keepSentinels?: boolean }): string | null {
  if (value == null) return null
  const s = typeof value === "string" ? value.trim() : String(value).trim()
  if (!s) return null
  if (!opts?.keepSentinels && SENTINEL_TOKENS.has(s.toLowerCase())) return null
  return s
}

/** Coerces to integer, or null for empty/sentinel/non-numeric input. */
export function coerceInt(value: unknown): number | null {
  if (isSentinel(value)) return null
  const n = typeof value === "number" ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

/** Coerces to finite float, or null for empty/sentinel/non-numeric input. */
export function coerceFloat(value: unknown): number | null {
  if (isSentinel(value)) return null
  const n = typeof value === "number" ? value : Number(String(value).trim())
  return Number.isFinite(n) ? n : null
}

/**
 * Coerces to a JavaScript `Date`, or null for empty/sentinel/unparseable.
 * Accepted formats (in priority order):
 *   1. Native `Date` objects from exceljs.
 *   2. Excel serial-day numbers (≥ 60 and < 60000; offset 1899-12-30).
 *   3. ISO strings ("1987-10-09", "1987-10-09 00:00:00", "1987-10-09T...").
 *   4. dd-mm-yyyy and dd/mm/yyyy ("19-03-2007", "19/03/2007").
 *   5. JS Date toString output ("Mon Jan 01 2024 05:00:00 GMT+0500 ...").
 *
 * Note on day-first ambiguity: 03-04-2007 is parsed as 3 April 2007
 * (Pakistani convention used in the team's templates), NOT 4 March 2007.
 */
export function coerceDate(value: unknown): Date | null {
  if (isSentinel(value)) return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null

  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToDate(value)
  }

  const raw = String(value).trim()
  if (!raw) return null

  // ISO date / datetime (Postgres + Excel "2024-01-01 00:00:00").
  // Both branches pin to UTC when the string has no explicit timezone —
  // bulk-import cells represent calendar dates owned by the data author,
  // not timestamped events. Without this pin, `new Date("2024-01-01")` is
  // UTC but `new Date("2024-01-01T00:00:00")` is LOCAL per the ES spec,
  // and exceljs's string output ("YYYY-MM-DD HH:mm:ss") falls into the
  // local-time branch — so a PKT-authored 1987-10-09 cell parsed on any
  // machine east of UTC would land as 1987-10-08 in Postgres.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00.000Z`)
    return Number.isFinite(d.getTime()) ? d : null
  }
  const dt = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?$/)
  if (dt) {
    const [, yyyy, mm, dd, hh, mi, ss, tz] = dt
    if (tz) {
      // Explicit timezone — let the engine handle it.
      const d = new Date(raw.replace(" ", "T"))
      return Number.isFinite(d.getTime()) ? d : null
    }
    const d = new Date(Date.UTC(
      Number(yyyy), Number(mm) - 1, Number(dd),
      Number(hh), Number(mi), ss ? Number(ss) : 0,
    ))
    return Number.isFinite(d.getTime()) ? d : null
  }

  // dd-mm-yyyy or dd/mm/yyyy (Pakistani / template convention) — pinned
  // to UTC midnight for the same round-trip reason.
  const dmy = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
  if (dmy) {
    const [, dd, mm, yyyy] = dmy
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)))
    return Number.isFinite(d.getTime()) ? d : null
  }

  // Fall back to JS Date string parsing (handles "Mon Jan 01 2024 …")
  const fallback = new Date(raw)
  return Number.isFinite(fallback.getTime()) ? fallback : null
}

/**
 * Converts an Excel serial-day number to a `Date`. Excel's epoch is
 * 1899-12-30 (accounting for its 1900 leap-year bug). Returns null for
 * values outside a sensible bulk-import range (1900-01-01 to ~2065).
 */
function excelSerialToDate(serial: number): Date | null {
  if (serial < 1 || serial > 80000) return null
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return Number.isFinite(d.getTime()) ? d : null
}

/**
 * Normalises a CNIC cell to the canonical "XXXXX-XXXXXXX-X" format.
 * Accepts variants like "4530149601116", "45301-49601116", "45301 4960111 6".
 * Returns null when the cleaned digits don't form a valid 13-digit CNIC.
 */
export function coerceCnic(value: unknown): string | null {
  if (isSentinel(value)) return null
  const digits = String(value).replace(/\D/g, "")
  if (digits.length !== 13) return null
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}
