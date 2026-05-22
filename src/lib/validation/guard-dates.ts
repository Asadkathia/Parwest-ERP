/**
 * Shared guard date validation.
 *
 * Single source of truth for the date/age rules applied at guard
 * enrollment. Used by BOTH the single-create flow (`POST /api/guards`) and
 * the bulk-import row schema (`src/lib/imports/definitions/guards.ts`) so the
 * two paths cannot drift apart.
 *
 * Pure + DB-free so it can be unit-tested in isolation. Accepts either raw
 * strings (single-create JSON body / Excel cell strings) or already-coerced
 * `Date` objects (bulk import after `coerceDate`). Returns the first error
 * message encountered, or `null` when every supplied date passes.
 *
 * Rules (mirror the legacy inline block at route.ts:124-153):
 *   - dateOfBirth (when present): age must be MIN_GUARD_AGE..MAX_GUARD_AGE.
 *   - cnicIssueDate (when present): must parse, must not be in the future.
 *   - cnicExpiryDate (when present): must parse, must be strictly after issue.
 */

import { calculateAgeYears, MIN_GUARD_AGE, MAX_GUARD_AGE } from "@/lib/validation/formats"

export type GuardDateInput = {
  dateOfBirth?: string | Date | null
  cnicIssueDate?: string | Date | null
  cnicExpiryDate?: string | Date | null
}

/** Narrow a string|Date|null|undefined into a usable trimmed string, or "". */
function asInput(value: string | Date | null | undefined): string | Date | "" {
  if (value == null) return ""
  if (value instanceof Date) return value
  const s = value.trim()
  return s
}

/** Parse a string|Date into a Date, or null when empty/unparseable. */
function toDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Validates the supplied guard dates. Returns the first error message, or
 * `null` if all present dates are valid.
 */
export function validateGuardDates(input: GuardDateInput): string | null {
  const dob = asInput(input.dateOfBirth)
  if (dob) {
    // calculateAgeYears accepts an ISO/parseable string; a Date is converted
    // to its ISO form so both call shapes share one age implementation.
    const dobStr = dob instanceof Date ? dob.toISOString() : dob
    const age = calculateAgeYears(dobStr)
    if (age == null || age < MIN_GUARD_AGE || age > MAX_GUARD_AGE) {
      return `Guard age must be between ${MIN_GUARD_AGE} and ${MAX_GUARD_AGE}.`
    }
  }

  const issueRaw = asInput(input.cnicIssueDate)
  let issueDate: Date | null = null
  if (issueRaw) {
    issueDate = toDate(issueRaw)
    if (!issueDate) {
      return "CNIC issue date is invalid."
    }
    if (issueDate.getTime() > Date.now()) {
      return "CNIC issue date cannot be in the future."
    }
  }

  const expiryRaw = asInput(input.cnicExpiryDate)
  if (expiryRaw) {
    const expiryDate = toDate(expiryRaw)
    if (!expiryDate) {
      return "CNIC expiry date is invalid."
    }
    if (issueDate && expiryDate.getTime() <= issueDate.getTime()) {
      return "CNIC expiry date must be after the issue date."
    }
  }

  return null
}
