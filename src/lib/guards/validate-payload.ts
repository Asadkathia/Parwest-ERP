/**
 * Shared guard-field validator.
 *
 * Single source of truth for the NON-date guard-field rules (phone format,
 * always-required core fields, education-year > DOB) applied at guard
 * enrollment and edit. The sibling `validateGuardDates`
 * (`src/lib/validation/guard-dates.ts`) owns the date/age rules; this module
 * deliberately delegates to it (and to `validateEducationPassingYear`) so the
 * two halves of the contract live in one place and the create form
 * (`new/form.tsx`), the create zod schema (`guard-create.ts`), the create API
 * (`POST /api/guards`), the edit API (`PUT /api/guards/[id]`), and bulk import
 * all share the same primitives.
 *
 * Pure + DB-free (like `validateGuardDates`) so it can be unit-tested in
 * isolation. Returns the first failing field + message, or `null` when valid.
 * Throws nothing.
 *
 * Two modes:
 *   - "create": format checks + the always-required core (name, dateOfBirth,
 *     at least one valid primary contact). These mirror the rules the create
 *     wizard enforces UNCONDITIONALLY (i.e. not behind a section toggle), so a
 *     direct API client cannot create a guard the wizard would reject.
 *   - "update": format checks only (an edit may legitimately touch a single
 *     field and must not be forced to resupply the whole profile).
 *
 * NOTE on phone normalization: callers should run `normalizeGuardPhone` on the
 * phone fields BEFORE persisting so the stored value is canonical. The
 * validator normalizes internally before testing the regex, so a `03XX-XXXXXXX`
 * input (edit form) and a `+92-3XX-XXXXXXX` input (create wizard / import) are
 * judged identically.
 */

import { CNIC_REGEX, PHONE_REGEX } from "@/lib/validation/formats"
import { validateGuardDates, validateEducationPassingYear, type GuardDateInput, type GuardDateError } from "@/lib/validation/guard-dates"

export type GuardPayloadField =
  | GuardDateError["field"]
  | "name"
  | "cnic"
  | "phone"
  | "permanentAddressContact"
  | "currentAddressContact"
  | "introducerCnic"
  | "introducerContact"
  | "passingYear"

export type GuardPayloadError = {
  field: GuardPayloadField
  message: string
}

export type GuardPayloadInput = GuardDateInput & {
  name?: string | null
  cnic?: string | null
  phone?: string | null
  permanentAddressContact?: string | null
  currentAddressContact?: string | null
  introducerCnic?: string | null
  introducerContact?: string | null
  education?: string | null
  passingYear?: string | number | null
}

export type GuardPayloadMode = "create" | "update"

const PHONE_FORMAT_MESSAGE = "Contact number must be in the format +92-300-1234567."
const CNIC_FORMAT_MESSAGE = "CNIC format must be XXXXX-XXXXXXX-X."

function str(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

/**
 * Normalise a Pakistani mobile toward the canonical +92-XXX-XXXXXXX shape.
 * Mirrors the import draft editor's PhoneCell normaliser so every write path
 * collapses 03xx / 3xx / 92… / 0092… to the same canonical form. Over-long /
 * malformed input is NOT truncated — it stays malformed so the PHONE_REGEX
 * check flags it instead of silently "fixing" it. Empty input returns "".
 */
export function normalizeGuardPhone(value: string | null | undefined): string {
  const raw = str(value)
  if (!raw) return ""
  let d = raw.replace(/\D/g, "")
  if (d.startsWith("0092")) d = d.slice(4)
  else if (d.startsWith("92") && d.length >= 12) d = d.slice(2)
  else if (d.startsWith("0")) d = d.slice(1)
  if (!d) return ""
  if (d.length <= 3) return `+92-${d}`
  return `+92-${d.slice(0, 3)}-${d.slice(3)}`
}

/** True when a present phone value is a valid canonical (or normalisable) number. */
export function isValidGuardPhone(value: string | null | undefined): boolean {
  const v = str(value)
  if (!v) return false
  if (PHONE_REGEX.test(v)) return true
  return PHONE_REGEX.test(normalizeGuardPhone(v))
}

/**
 * Validate the non-date guard fields. Returns the first failing field +
 * message, or `null` when all pass. Combines (in order):
 *   1. required-core checks (create mode only),
 *   2. format checks (phone / CNIC / optional introducer fields),
 *   3. shared date/age checks (`validateGuardDates`),
 *   4. education-year > DOB (`validateEducationPassingYear`).
 */
export function validateGuardPayload(
  input: GuardPayloadInput,
  mode: GuardPayloadMode = "create",
): GuardPayloadError | null {
  // ── 1. Always-required core (create only) ──────────────────────────────
  // These mirror the create wizard's UNCONDITIONAL submit checks (name, a
  // valid DOB/age, and at least one valid primary contact). Section-gated
  // fields (addresses, father/mother name, etc.) are intentionally NOT forced
  // here so a wizard submission that legitimately omits an unchecked section
  // is not rejected, and an edit can touch a single field.
  if (mode === "create") {
    if (!str(input.name)) {
      return { field: "name", message: "Full name is required." }
    }
    if (!str(input.dateOfBirth)) {
      return { field: "dateOfBirth", message: "Date of birth is required." }
    }
    if (!str(input.phone)) {
      return { field: "phone", message: "At least one contact number is required." }
    }
  }

  // ── 2. Format checks (both modes, only when a value is present) ─────────
  const phone = str(input.phone)
  if (phone && !isValidGuardPhone(phone)) {
    return { field: "phone", message: PHONE_FORMAT_MESSAGE }
  }
  const permanentContact = str(input.permanentAddressContact)
  if (permanentContact && !isValidGuardPhone(permanentContact)) {
    return { field: "permanentAddressContact", message: PHONE_FORMAT_MESSAGE }
  }
  const currentContact = str(input.currentAddressContact)
  if (currentContact && !isValidGuardPhone(currentContact)) {
    return { field: "currentAddressContact", message: PHONE_FORMAT_MESSAGE }
  }
  const introducerContact = str(input.introducerContact)
  if (introducerContact && !isValidGuardPhone(introducerContact)) {
    return { field: "introducerContact", message: PHONE_FORMAT_MESSAGE }
  }
  const introducerCnic = str(input.introducerCnic)
  if (introducerCnic && !CNIC_REGEX.test(introducerCnic)) {
    return { field: "introducerCnic", message: CNIC_FORMAT_MESSAGE }
  }

  // ── 3. Shared date/age checks ──────────────────────────────────────────
  const dateError = validateGuardDates({
    dateOfBirth: input.dateOfBirth,
    cnicIssueDate: input.cnicIssueDate,
    cnicExpiryDate: input.cnicExpiryDate,
  })
  if (dateError) return dateError

  // ── 4. Education passing year > DOB ────────────────────────────────────
  const eduError = validateEducationPassingYear(input.dateOfBirth, input.passingYear)
  if (eduError) {
    return { field: "passingYear", message: eduError }
  }

  return null
}
