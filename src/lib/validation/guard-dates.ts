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
 * Rules:
 *   - dateOfBirth (when present): age must be MIN_GUARD_AGE..MAX_GUARD_AGE.
 *   - cnicIssueDate (when present): must parse, must not be in the future.
 *   - dateOfBirth must not be after cnicIssueDate (a CNIC can't predate birth).
 *   - cnicExpiryDate (when present): must parse, must be strictly after issue,
 *     and must not already be expired (an expired CNIC can't be registered).
 *
 * Returns the first failing field + message, or `null` when all pass. The
 * `field` lets the bulk-import editor attach the error to the right cell.
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

export type GuardDateField = "dateOfBirth" | "cnicIssueDate" | "cnicExpiryDate"

export type GuardDateError = {
  /** The field the message applies to — used to attach the error to a cell. */
  field: GuardDateField
  message: string
}

/**
 * Validates the supplied guard dates. Returns the first failing field +
 * message, or `null` if all present dates are valid.
 */
export function validateGuardDates(input: GuardDateInput): GuardDateError | null {
  const dobRaw = asInput(input.dateOfBirth)
  const dobDate = dobRaw ? toDate(dobRaw) : null
  if (dobRaw) {
    // calculateAgeYears accepts an ISO/parseable string; a Date is converted
    // to its ISO form so both call shapes share one age implementation.
    const dobStr = dobRaw instanceof Date ? dobRaw.toISOString() : dobRaw
    const age = calculateAgeYears(dobStr)
    if (age == null || age < MIN_GUARD_AGE || age > MAX_GUARD_AGE) {
      return {
        field: "dateOfBirth",
        message: `Guard age must be between ${MIN_GUARD_AGE} and ${MAX_GUARD_AGE}.`,
      }
    }
  }

  const issueRaw = asInput(input.cnicIssueDate)
  let issueDate: Date | null = null
  if (issueRaw) {
    issueDate = toDate(issueRaw)
    if (!issueDate) {
      return { field: "cnicIssueDate", message: "CNIC issue date is invalid." }
    }
    if (issueDate.getTime() > Date.now()) {
      return { field: "cnicIssueDate", message: "CNIC issue date cannot be in the future." }
    }
  }

  // A CNIC cannot be issued before the holder was born.
  if (dobDate && issueDate && dobDate.getTime() > issueDate.getTime()) {
    return {
      field: "dateOfBirth",
      message: "Date of birth cannot be after the CNIC issue date.",
    }
  }

  const expiryRaw = asInput(input.cnicExpiryDate)
  if (expiryRaw) {
    const expiryDate = toDate(expiryRaw)
    if (!expiryDate) {
      return { field: "cnicExpiryDate", message: "CNIC expiry date is invalid." }
    }
    if (issueDate && expiryDate.getTime() <= issueDate.getTime()) {
      return { field: "cnicExpiryDate", message: "CNIC expiry date must be after the issue date." }
    }
    // Reject an already-expired CNIC. Compare against the start of today so a
    // CNIC expiring today still counts as valid.
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    if (expiryDate.getTime() < startOfToday.getTime()) {
      return { field: "cnicExpiryDate", message: "CNIC has expired and cannot be registered." }
    }
  }

  return null
}
