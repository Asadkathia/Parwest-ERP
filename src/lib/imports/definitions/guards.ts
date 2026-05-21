/**
 * Guards bulk import — aligned with the ERP team's 114-column template.
 *
 * The template uses lowercase / space-separated headers ("father name",
 * "first nearest relative cnic number", "marital_status"). We declare
 * those headers verbatim, then remap each row to canonical camelCase
 * keys via `headerAliases` before validation runs. The persist function
 * uses the shared `buildGuardCreatePayload` builder so single-create
 * (`POST /api/guards`) and bulk write the same column set — drift between
 * the two paths is structurally impossible.
 *
 * Storage map at a glance:
 *   - 60+ flat columns        → Guard scalar fields (via build-payload).
 *   - 3 nearest-relative cols → Guard.nearestRelativesJson.
 *   - 3 family-member cols    → Guard.familyMembersJson.
 *   - 3 prev-employment cols  → Guard.previousEmploymentsJson.
 *   - 3 judicial-case cols    → GuardJudicialCase rows (relation).
 *   - `parwest id`           → honoured when present; else generated.
 *   - `regional office`      → series-code letter resolved to RO.id.
 */

import { z } from "zod"

import { prisma } from "@/lib/db"
import { registerImport } from "@/lib/imports/registry"
import { cnicField, memoizedResolver, requiredString } from "@/lib/imports/rules"
import { buildGuardCreatePayload } from "@/lib/guards/build-payload"
import { coerceCnic, coerceDate, coerceString } from "@/lib/imports/coerce"
import { recordGuardServiceEvent } from "@/lib/guards/service-history"
import { recordGuardStatusChange } from "@/lib/guards/status-history"
import { generateNextParwestId } from "@/lib/guards/parwest-id"
import type { Prisma } from "@prisma/client"
import type { ColumnDescriptor } from "@/lib/imports/types"

/* ────────────────────────────────────────────────────────────────────── */
/* Header strings — exact match to the ERP team's Guard_Basic_Details.xlsx */
/* ────────────────────────────────────────────────────────────────────── */

/** Required: name + cnic. Every other column is optional. */
const REQUIRED_HEADERS = ["name", "cnic"] as const

const OPTIONAL_HEADERS = [
  "parwest id", "regional office", "father name", "mother name", "date of birth",
  "cnic issue date", "cnic expiry date", "next of kin", "contact no",
  "religion", "sect", "cast",
  "designation", "salary", "police station", "blood group", "ex service",
  "other", "registration no", "rank", "group", "service period",
  "service years", "service months", "date of enrolment", "date of discharge",
  "remarks", "current address", "current address number", "permanent address",
  "permanent address number", "education level", "education passing year",
  "education name of institution", "introducer name", "introducer cnic",
  "introducer number", "introducer address", "height", "weight", "eye color",
  "hair color", "disability", "mark of identification", "current status",
  // First / second / third previous employment
  "first employment company", "first employment start date", "first employment end date",
  "second employment company", "second employment start date", "second employment end date",
  "third employment company", "third employment start date", "third employment end date",
  // First / second / third nearest relative (8 cols each)
  "first nearest relative", "first nearest relative father name", "first nearest relative relation",
  "first nearest relative cnic number", "first nearest relative cnic issue date",
  "first nearest relative profession", "first nearest relative contact number",
  "first nearest relative address",
  "second nearest relative", "second nearest relative father name", "second nearest relative relation",
  "second nearest relative cnic number", "second nearest relative cnic issue date",
  "second nearest relative profession", "second nearest relative contact number",
  "second nearest relative address",
  "third nearest relative", "third nearest relative father name", "third nearest relative relation",
  "third nearest relative cnic number", "third nearest relative cnic issue date",
  "third nearest relative profession", "third nearest relative contact number",
  "third nearest relative address",
  // First / second / third family member (5 cols each)
  "first family name", "first family relation", "first family age",
  "first family profession", "first family address",
  "second family name", "second family relation", "second family age",
  "second family profession", "second family address",
  "third family name", "third family relation", "third family age",
  "third family profession", "third family address",
  // First / second / third judicial case (5 cols each)
  "first judicial case no", "first judicial case date", "first judicial case police station",
  "first judicial case investigation result", "first judicial case court result",
  "second judicial case no", "second judicial case date", "second judicial case police station",
  "second judicial case investigation result", "second judicial case court result",
  "third judicial case no", "third judicial case date", "third judicial case police station",
  "third judicial case investigation result", "third judicial case court result",
  // Misc
  "marital_status",
] as const

/* ────────────────────────────────────────────────────────────────────── */
/* Header alias map — sheet header → canonical camelCase key              */
/* ────────────────────────────────────────────────────────────────────── */

const HEADER_ALIASES: Record<string, string> = {
  "parwest id": "parwestIdInput",
  "regional office": "regionalOfficeSeries",
  "father name": "fatherName",
  "mother name": "motherName",
  "date of birth": "dateOfBirth",
  "cnic issue date": "cnicIssueDate",
  "cnic expiry date": "cnicExpiryDate",
  "next of kin": "nextOfKin",
  "contact no": "phone",
  religion: "religion",
  sect: "sect",
  cast: "cast",
  designation: "designation",
  salary: "salary",
  "police station": "policeStation",
  "blood group": "bloodGroup",
  "ex service": "exServiceTypeRaw",
  other: "exServiceOtherLabel",
  "registration no": "exServiceRegistrationNo",
  rank: "exServiceRank",
  group: "exServiceUnit",
  "service period": "exServicePeriod",
  "service years": "exServiceYears",
  "service months": "exServiceMonths",
  "date of enrolment": "dateOfEnrollment",
  "date of discharge": "dateOfDischarge",
  remarks: "exServiceRemarks",
  "current address": "addressCurrent",
  "current address number": "currentAddressContact",
  "permanent address": "addressPermanent",
  "permanent address number": "permanentAddressContact",
  "education level": "education",
  "education passing year": "passingYear",
  "education name of institution": "educationInstitute",
  "introducer name": "introducerName",
  "introducer cnic": "introducerCnic",
  "introducer number": "introducerContact",
  "introducer address": "introducerAddress",
  height: "height",
  weight: "weight",
  "eye color": "eyeColor",
  "hair color": "hairColor",
  disability: "disability",
  "mark of identification": "identificationMark",
  "current status": "currentStatusRaw",
  marital_status: "maritalStatus",
}
// Indexed groups (nearest / family / employment / judicial). The persist
// function reads them by canonical name so the alias map collapses each
// group's columns to predictable keys.
for (const ord of ["first", "second", "third"] as const) {
  const idx = ord === "first" ? 1 : ord === "second" ? 2 : 3
  HEADER_ALIASES[`${ord} nearest relative`] = `nearest_${idx}_name`
  HEADER_ALIASES[`${ord} nearest relative father name`] = `nearest_${idx}_fatherName`
  HEADER_ALIASES[`${ord} nearest relative relation`] = `nearest_${idx}_relation`
  HEADER_ALIASES[`${ord} nearest relative cnic number`] = `nearest_${idx}_cnic`
  HEADER_ALIASES[`${ord} nearest relative cnic issue date`] = `nearest_${idx}_cnicIssueDate`
  HEADER_ALIASES[`${ord} nearest relative profession`] = `nearest_${idx}_profession`
  HEADER_ALIASES[`${ord} nearest relative contact number`] = `nearest_${idx}_contact`
  HEADER_ALIASES[`${ord} nearest relative address`] = `nearest_${idx}_address`

  HEADER_ALIASES[`${ord} family name`] = `family_${idx}_name`
  HEADER_ALIASES[`${ord} family relation`] = `family_${idx}_relation`
  HEADER_ALIASES[`${ord} family age`] = `family_${idx}_age`
  HEADER_ALIASES[`${ord} family profession`] = `family_${idx}_profession`
  HEADER_ALIASES[`${ord} family address`] = `family_${idx}_address`

  HEADER_ALIASES[`${ord} employment company`] = `employment_${idx}_unit`
  HEADER_ALIASES[`${ord} employment start date`] = `employment_${idx}_dateOfEnrollment`
  HEADER_ALIASES[`${ord} employment end date`] = `employment_${idx}_dateOfDischarge`

  HEADER_ALIASES[`${ord} judicial case no`] = `judicial_${idx}_caseNo`
  HEADER_ALIASES[`${ord} judicial case date`] = `judicial_${idx}_caseDate`
  HEADER_ALIASES[`${ord} judicial case police station`] = `judicial_${idx}_policeStation`
  HEADER_ALIASES[`${ord} judicial case investigation result`] = `judicial_${idx}_investigationResult`
  HEADER_ALIASES[`${ord} judicial case court result`] = `judicial_${idx}_courtResult`
}

/* ────────────────────────────────────────────────────────────────────── */
/* Row schema — required: name + cnic. Everything else is opaque pass-     */
/* through. Validation of the regional-office code is owned by its         */
/* resolver (see below); the schema runs AFTER resolution, so any length   */
/* / format check declared here would see the resolved RegionalOffice.id   */
/* (a 25-char cuid), not the original cell value. Coercion of optional     */
/* fields happens inside `buildGuardCreatePayload` via the coerce helpers. */
/* ────────────────────────────────────────────────────────────────────── */

const rowSchema = z
  .object({
    name: requiredString("name", 200),
    cnic: cnicField(),
  })
  .passthrough()

/* ────────────────────────────────────────────────────────────────────── */
/* RegionalOffice resolver — input is the series-code letter (e.g. "K")   */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Resolves a regional-office series-code letter (e.g. "K") to the
 * RegionalOffice.id. On miss, throws an enriched error listing every
 * seriesCode currently registered in the system — saves the user a trip
 * to /settings/regions just to discover which codes are available.
 *
 * The list is cached in the run-scoped cache so we don't query the table
 * once per missing row.
 */
const regionalOfficeResolver = memoizedResolver<string>(
  "guard.regionalOffice",
  async (raw, ctx) => {
    const code = raw.trim().toUpperCase()
    if (!code) return null
    const ro = await prisma.regionalOffice.findUnique({
      where: { seriesCode: code },
      select: { id: true },
    })
    if (ro) return ro.id

    // Miss — enrich the failure with the set of valid codes.
    const AVAILABLE_KEY = "guard.regionalOffice.availableCodes"
    let available = ctx.cache.get(AVAILABLE_KEY) as string[] | undefined
    if (!available) {
      const rows = await prisma.regionalOffice.findMany({
        select: { seriesCode: true },
        orderBy: { seriesCode: "asc" },
      })
      available = rows.map((r) => r.seriesCode).filter(Boolean)
      ctx.cache.set(AVAILABLE_KEY, available)
    }
    const hint = available.length
      ? `Available codes: ${available.join(", ")}.`
      : "No regional offices exist yet — create one in /settings/regions first."
    throw new Error(`Regional office "${code}" not found. ${hint}`)
  },
)

/* ────────────────────────────────────────────────────────────────────── */
/* Group-assembly helpers — fold the indexed columns into JSON arrays /   */
/* judicial-case rows                                                     */
/* ────────────────────────────────────────────────────────────────────── */

type Indexed<T extends string> = `${T}_${1 | 2 | 3}_${string}`
function pickGroup<T extends string>(
  row: Record<string, unknown>,
  prefix: T,
  fields: string[],
): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = []
  for (const idx of [1, 2, 3] as const) {
    const entry: Record<string, string> = {}
    for (const f of fields) {
      const key = `${prefix}_${idx}_${f}` as Indexed<T>
      const v = coerceString(row[key])
      if (v) entry[f] = v
    }
    if (Object.keys(entry).length > 0) out.push(entry)
  }
  return out
}

type JudicialCase = {
  caseNo: string | null
  caseDate: Date | null
  policeStation: string | null
  investigationResult: string | null
  courtResult: string | null
}
function pickJudicialCases(row: Record<string, unknown>): JudicialCase[] {
  const out: JudicialCase[] = []
  for (const idx of [1, 2, 3] as const) {
    const c: JudicialCase = {
      caseNo: coerceString(row[`judicial_${idx}_caseNo`]),
      caseDate: coerceDate(row[`judicial_${idx}_caseDate`]),
      policeStation: coerceString(row[`judicial_${idx}_policeStation`]),
      investigationResult: coerceString(row[`judicial_${idx}_investigationResult`]),
      courtResult: coerceString(row[`judicial_${idx}_courtResult`]),
    }
    if (
      c.caseNo ||
      c.caseDate ||
      c.policeStation ||
      c.investigationResult ||
      c.courtResult
    ) {
      out.push(c)
    }
  }
  return out
}

/** Maps the team's `current status` strings to a lifecycle value. */
function mapCurrentStatus(raw: string | null): { status: string; lifecycleStatus: string } {
  if (!raw) return { status: "PENDING", lifecycleStatus: "PENDING" }
  const v = raw.trim().toLowerCase()
  if (["active", "present", "default"].includes(v)) return { status: "ACTIVE", lifecycleStatus: "ACTIVE" }
  if (v === "inactive") return { status: "INACTIVE", lifecycleStatus: "INACTIVE" }
  if (["terminated", "fired", "resigned", "absconded"].includes(v)) return { status: "TERMINATED", lifecycleStatus: "TERMINATED" }
  return { status: "PENDING", lifecycleStatus: "PENDING" }
}

/* ────────────────────────────────────────────────────────────────────── */
/* Column descriptors — drives the draft editor's per-cell editor choice  */
/* ────────────────────────────────────────────────────────────────────── */

const GUARDS_COLUMNS: ColumnDescriptor[] = [
  // Required
  { key: "name", header: "name", label: "Name", kind: "text", required: true },
  { key: "cnic", header: "cnic", label: "CNIC", kind: "cnic", required: true },

  // Identity / metadata
  { key: "parwestIdInput", header: "parwest id", label: "Parwest ID", kind: "text", required: false },
  {
    key: "regionalOfficeSeries",
    header: "regional office",
    label: "Regional Office",
    kind: "fk",
    required: false,
    fkOptionsLoader: async (ctx) => {
      const rows = await ctx.prisma.regionalOffice.findMany({
        select: { seriesCode: true, name: true },
        orderBy: { name: "asc" },
      })
      return rows
        .filter((r) => r.seriesCode)
        .map((r) => ({ value: r.seriesCode, label: `${r.seriesCode} — ${r.name}` }))
    },
  },
  { key: "fatherName", header: "father name", label: "Father Name", kind: "text", required: false },
  { key: "motherName", header: "mother name", label: "Mother Name", kind: "text", required: false },
  { key: "dateOfBirth", header: "date of birth", label: "Date of Birth", kind: "date", required: false },
  { key: "cnicIssueDate", header: "cnic issue date", label: "CNIC Issue Date", kind: "date", required: false },
  { key: "cnicExpiryDate", header: "cnic expiry date", label: "CNIC Expiry Date", kind: "date", required: false },
  { key: "nextOfKin", header: "next of kin", label: "Next of Kin", kind: "text", required: false },
  { key: "phone", header: "contact no", label: "Contact No", kind: "text", required: false },
  { key: "religion", header: "religion", label: "Religion", kind: "text", required: false },
  { key: "sect", header: "sect", label: "Sect", kind: "text", required: false },
  { key: "cast", header: "cast", label: "Cast", kind: "text", required: false },
  { key: "designation", header: "designation", label: "Designation", kind: "text", required: false },
  { key: "salary", header: "salary", label: "Salary", kind: "number", required: false },
  { key: "policeStation", header: "police station", label: "Police Station", kind: "text", required: false },
  { key: "bloodGroup", header: "blood group", label: "Blood Group", kind: "text", required: false },
  { key: "exServiceTypeRaw", header: "ex service", label: "Ex Service", kind: "text", required: false },
  { key: "exServiceOtherLabel", header: "other", label: "Other", kind: "text", required: false },
  { key: "exServiceRegistrationNo", header: "registration no", label: "Registration No", kind: "text", required: false },
  { key: "exServiceRank", header: "rank", label: "Rank", kind: "text", required: false },
  { key: "exServiceUnit", header: "group", label: "Group / Unit", kind: "text", required: false },
  { key: "exServicePeriod", header: "service period", label: "Service Period", kind: "text", required: false },
  { key: "exServiceYears", header: "service years", label: "Service Years", kind: "number", required: false },
  { key: "exServiceMonths", header: "service months", label: "Service Months", kind: "number", required: false },
  { key: "dateOfEnrollment", header: "date of enrolment", label: "Date of Enrolment", kind: "date", required: false },
  { key: "dateOfDischarge", header: "date of discharge", label: "Date of Discharge", kind: "date", required: false },
  { key: "exServiceRemarks", header: "remarks", label: "Remarks", kind: "text", required: false },
  { key: "addressCurrent", header: "current address", label: "Current Address", kind: "text", required: false },
  { key: "currentAddressContact", header: "current address number", label: "Current Address Contact", kind: "text", required: false },
  { key: "addressPermanent", header: "permanent address", label: "Permanent Address", kind: "text", required: false },
  { key: "permanentAddressContact", header: "permanent address number", label: "Permanent Address Contact", kind: "text", required: false },
  { key: "education", header: "education level", label: "Education Level", kind: "text", required: false },
  { key: "passingYear", header: "education passing year", label: "Education Passing Year", kind: "number", required: false },
  { key: "educationInstitute", header: "education name of institution", label: "Education Institution", kind: "text", required: false },
  { key: "introducerName", header: "introducer name", label: "Introducer Name", kind: "text", required: false },
  { key: "introducerCnic", header: "introducer cnic", label: "Introducer CNIC", kind: "cnic", required: false },
  { key: "introducerContact", header: "introducer number", label: "Introducer Contact", kind: "text", required: false },
  { key: "introducerAddress", header: "introducer address", label: "Introducer Address", kind: "text", required: false },
  { key: "height", header: "height", label: "Height", kind: "number", required: false },
  { key: "weight", header: "weight", label: "Weight", kind: "number", required: false },
  { key: "eyeColor", header: "eye color", label: "Eye Color", kind: "text", required: false },
  { key: "hairColor", header: "hair color", label: "Hair Color", kind: "text", required: false },
  { key: "disability", header: "disability", label: "Disability", kind: "text", required: false },
  { key: "identificationMark", header: "mark of identification", label: "Mark of Identification", kind: "text", required: false },
  {
    key: "currentStatusRaw",
    header: "current status",
    label: "Current Status",
    kind: "enum",
    required: false,
    enumValues: ["active", "inactive", "terminated", "resigned", "absconded", "fired"],
  },

  // First / second / third previous employment
  { key: "employment_1_unit", header: "first employment company", label: "First Employment Company", kind: "text", required: false },
  { key: "employment_1_dateOfEnrollment", header: "first employment start date", label: "First Employment Start", kind: "date", required: false },
  { key: "employment_1_dateOfDischarge", header: "first employment end date", label: "First Employment End", kind: "date", required: false },
  { key: "employment_2_unit", header: "second employment company", label: "Second Employment Company", kind: "text", required: false },
  { key: "employment_2_dateOfEnrollment", header: "second employment start date", label: "Second Employment Start", kind: "date", required: false },
  { key: "employment_2_dateOfDischarge", header: "second employment end date", label: "Second Employment End", kind: "date", required: false },
  { key: "employment_3_unit", header: "third employment company", label: "Third Employment Company", kind: "text", required: false },
  { key: "employment_3_dateOfEnrollment", header: "third employment start date", label: "Third Employment Start", kind: "date", required: false },
  { key: "employment_3_dateOfDischarge", header: "third employment end date", label: "Third Employment End", kind: "date", required: false },

  // First / second / third nearest relative (8 cols each)
  { key: "nearest_1_name", header: "first nearest relative", label: "First Nearest Relative", kind: "text", required: false },
  { key: "nearest_1_fatherName", header: "first nearest relative father name", label: "First Nearest Relative Father", kind: "text", required: false },
  { key: "nearest_1_relation", header: "first nearest relative relation", label: "First Nearest Relative Relation", kind: "text", required: false },
  { key: "nearest_1_cnic", header: "first nearest relative cnic number", label: "First Nearest Relative CNIC", kind: "cnic", required: false },
  { key: "nearest_1_cnicIssueDate", header: "first nearest relative cnic issue date", label: "First Nearest Relative CNIC Issue Date", kind: "date", required: false },
  { key: "nearest_1_profession", header: "first nearest relative profession", label: "First Nearest Relative Profession", kind: "text", required: false },
  { key: "nearest_1_contact", header: "first nearest relative contact number", label: "First Nearest Relative Contact", kind: "text", required: false },
  { key: "nearest_1_address", header: "first nearest relative address", label: "First Nearest Relative Address", kind: "text", required: false },
  { key: "nearest_2_name", header: "second nearest relative", label: "Second Nearest Relative", kind: "text", required: false },
  { key: "nearest_2_fatherName", header: "second nearest relative father name", label: "Second Nearest Relative Father", kind: "text", required: false },
  { key: "nearest_2_relation", header: "second nearest relative relation", label: "Second Nearest Relative Relation", kind: "text", required: false },
  { key: "nearest_2_cnic", header: "second nearest relative cnic number", label: "Second Nearest Relative CNIC", kind: "cnic", required: false },
  { key: "nearest_2_cnicIssueDate", header: "second nearest relative cnic issue date", label: "Second Nearest Relative CNIC Issue Date", kind: "date", required: false },
  { key: "nearest_2_profession", header: "second nearest relative profession", label: "Second Nearest Relative Profession", kind: "text", required: false },
  { key: "nearest_2_contact", header: "second nearest relative contact number", label: "Second Nearest Relative Contact", kind: "text", required: false },
  { key: "nearest_2_address", header: "second nearest relative address", label: "Second Nearest Relative Address", kind: "text", required: false },
  { key: "nearest_3_name", header: "third nearest relative", label: "Third Nearest Relative", kind: "text", required: false },
  { key: "nearest_3_fatherName", header: "third nearest relative father name", label: "Third Nearest Relative Father", kind: "text", required: false },
  { key: "nearest_3_relation", header: "third nearest relative relation", label: "Third Nearest Relative Relation", kind: "text", required: false },
  { key: "nearest_3_cnic", header: "third nearest relative cnic number", label: "Third Nearest Relative CNIC", kind: "cnic", required: false },
  { key: "nearest_3_cnicIssueDate", header: "third nearest relative cnic issue date", label: "Third Nearest Relative CNIC Issue Date", kind: "date", required: false },
  { key: "nearest_3_profession", header: "third nearest relative profession", label: "Third Nearest Relative Profession", kind: "text", required: false },
  { key: "nearest_3_contact", header: "third nearest relative contact number", label: "Third Nearest Relative Contact", kind: "text", required: false },
  { key: "nearest_3_address", header: "third nearest relative address", label: "Third Nearest Relative Address", kind: "text", required: false },

  // First / second / third family member (5 cols each)
  { key: "family_1_name", header: "first family name", label: "First Family Name", kind: "text", required: false },
  { key: "family_1_relation", header: "first family relation", label: "First Family Relation", kind: "text", required: false },
  { key: "family_1_age", header: "first family age", label: "First Family Age", kind: "number", required: false },
  { key: "family_1_profession", header: "first family profession", label: "First Family Profession", kind: "text", required: false },
  { key: "family_1_address", header: "first family address", label: "First Family Address", kind: "text", required: false },
  { key: "family_2_name", header: "second family name", label: "Second Family Name", kind: "text", required: false },
  { key: "family_2_relation", header: "second family relation", label: "Second Family Relation", kind: "text", required: false },
  { key: "family_2_age", header: "second family age", label: "Second Family Age", kind: "number", required: false },
  { key: "family_2_profession", header: "second family profession", label: "Second Family Profession", kind: "text", required: false },
  { key: "family_2_address", header: "second family address", label: "Second Family Address", kind: "text", required: false },
  { key: "family_3_name", header: "third family name", label: "Third Family Name", kind: "text", required: false },
  { key: "family_3_relation", header: "third family relation", label: "Third Family Relation", kind: "text", required: false },
  { key: "family_3_age", header: "third family age", label: "Third Family Age", kind: "number", required: false },
  { key: "family_3_profession", header: "third family profession", label: "Third Family Profession", kind: "text", required: false },
  { key: "family_3_address", header: "third family address", label: "Third Family Address", kind: "text", required: false },

  // First / second / third judicial case (5 cols each)
  { key: "judicial_1_caseNo", header: "first judicial case no", label: "First Judicial Case No", kind: "text", required: false },
  { key: "judicial_1_caseDate", header: "first judicial case date", label: "First Judicial Case Date", kind: "date", required: false },
  { key: "judicial_1_policeStation", header: "first judicial case police station", label: "First Judicial Police Station", kind: "text", required: false },
  { key: "judicial_1_investigationResult", header: "first judicial case investigation result", label: "First Judicial Investigation Result", kind: "text", required: false },
  { key: "judicial_1_courtResult", header: "first judicial case court result", label: "First Judicial Court Result", kind: "text", required: false },
  { key: "judicial_2_caseNo", header: "second judicial case no", label: "Second Judicial Case No", kind: "text", required: false },
  { key: "judicial_2_caseDate", header: "second judicial case date", label: "Second Judicial Case Date", kind: "date", required: false },
  { key: "judicial_2_policeStation", header: "second judicial case police station", label: "Second Judicial Police Station", kind: "text", required: false },
  { key: "judicial_2_investigationResult", header: "second judicial case investigation result", label: "Second Judicial Investigation Result", kind: "text", required: false },
  { key: "judicial_2_courtResult", header: "second judicial case court result", label: "Second Judicial Court Result", kind: "text", required: false },
  { key: "judicial_3_caseNo", header: "third judicial case no", label: "Third Judicial Case No", kind: "text", required: false },
  { key: "judicial_3_caseDate", header: "third judicial case date", label: "Third Judicial Case Date", kind: "date", required: false },
  { key: "judicial_3_policeStation", header: "third judicial case police station", label: "Third Judicial Police Station", kind: "text", required: false },
  { key: "judicial_3_investigationResult", header: "third judicial case investigation result", label: "Third Judicial Investigation Result", kind: "text", required: false },
  { key: "judicial_3_courtResult", header: "third judicial case court result", label: "Third Judicial Court Result", kind: "text", required: false },

  // Misc
  {
    key: "maritalStatus",
    header: "marital_status",
    label: "Marital Status",
    kind: "enum",
    required: false,
    enumValues: ["single", "married", "divorced", "widowed"],
  },
]

/* ────────────────────────────────────────────────────────────────────── */
/* Definition registration                                                */
/* ────────────────────────────────────────────────────────────────────── */

registerImport({
  module: "guards",
  label: "Guards",
  description:
    "Bulk-enrol guards. Accepts the ERP team's 114-column Guard_Basic_Details template.",
  requiredHeaders: [...REQUIRED_HEADERS],
  optionalHeaders: [...OPTIONAL_HEADERS],
  headerAliases: HEADER_ALIASES,
  rowSchema,
  referenceResolvers: { regionalOfficeSeries: regionalOfficeResolver },
  columns: GUARDS_COLUMNS,
  duplicates: [
    {
      fields: ["cnic"],
      scope: "both",
      message: "CNIC already exists",
      existsInDb: async (values) => {
        const cnic = coerceCnic(values.cnic) ?? values.cnic
        const found = await prisma.guard.findUnique({
          where: { cnic },
          select: { id: true },
        })
        return Boolean(found)
      },
    },
  ],
  sampleRows: [
    { name: "Sample One", cnic: "35202-1234567-1", "regional office": "K" },
    { name: "Sample Two", cnic: "35202-7654321-1", "regional office": "L" },
  ],
  persist: async (row, ctx) => {
    const r = row as Record<string, unknown>

    // ── Regional office (already resolved to RO.id by the engine) ──
    let regionalOfficeId: string | null = null
    let regionId: string | null = null
    let officeSeriesCode: string | null = null
    let regionName: string | null = null
    let officeName: string | null = null
    const roIdInput = coerceString(r.regionalOfficeSeries)
    if (roIdInput) {
      const ro = await ctx.tx.regionalOffice.findUnique({
        where: { id: roIdInput },
        select: { id: true, regionId: true, seriesCode: true, name: true, region: { select: { name: true } } },
      })
      if (!ro) throw new Error("Regional office no longer exists")
      regionalOfficeId = ro.id
      regionId = ro.regionId
      officeSeriesCode = ro.seriesCode
      regionName = ro.region?.name ?? null
      officeName = ro.name
    }

    // ── parwestId: honour template value when valid, else generate ──
    const parwestIdInput = coerceString(r.parwestIdInput)
    let parwestId: string
    if (parwestIdInput && /^PW-[A-Z]+-\d+$/.test(parwestIdInput.toUpperCase())) {
      const normalized = parwestIdInput.toUpperCase()
      const existing = await ctx.tx.guard.findUnique({
        where: { parwestId: normalized },
        select: { id: true },
      })
      if (existing) {
        throw new Error(`parwest id "${normalized}" already exists`)
      }
      parwestId = normalized
    } else if (parwestIdInput) {
      // Team's template often supplies short ids like "K-39995". Normalise.
      const ksMatch = parwestIdInput.match(/^([A-Z]+)[-\s]?(\d+)$/i)
      if (ksMatch) {
        const candidate = `PW-${ksMatch[1].toUpperCase()}-${ksMatch[2].padStart(5, "0")}`
        const existing = await ctx.tx.guard.findUnique({
          where: { parwestId: candidate },
          select: { id: true },
        })
        parwestId = existing ? await generateNextParwestId(ctx.tx, officeSeriesCode) : candidate
      } else {
        parwestId = await generateNextParwestId(ctx.tx, officeSeriesCode)
      }
    } else {
      parwestId = await generateNextParwestId(ctx.tx, officeSeriesCode)
    }

    // ── Multi-entry groups ──
    const nearestRelatives = pickGroup(r, "nearest", [
      "name", "fatherName", "relation", "cnic", "cnicIssueDate", "profession", "contact", "address",
    ])
    const familyMembers = pickGroup(r, "family", [
      "name", "relation", "age", "profession", "address",
    ])
    const previousEmployments = pickGroup(r, "employment", [
      "unit", "dateOfEnrollment", "dateOfDischarge",
    ])
    const judicialCases = pickJudicialCases(r)

    // ── Ex-service type derivation ──
    const exServiceTypeRaw = (coerceString(r.exServiceTypeRaw) ?? "").toLowerCase()
    const knownExService = ["army", "police", "rangers", "mujahid", "other"]
    const exServiceType = knownExService.includes(exServiceTypeRaw)
      ? exServiceTypeRaw.toUpperCase()
      : "CIVILIAN"
    const isExService = exServiceType !== "CIVILIAN"

    // ── Current status mapping ──
    const lifecycle = mapCurrentStatus(coerceString(r.currentStatusRaw))

    // ── Compose the create payload via the shared builder ──
    const flat: Record<string, unknown> = { ...r, status: lifecycle.status }
    const payload = buildGuardCreatePayload({
      parwestId,
      name: coerceString(r.name) ?? "",
      cnic: coerceCnic(r.cnic) ?? String(r.cnic ?? "").trim(),
      bodyRegionId: regionId,
      bodyRegionalOfficeId: regionalOfficeId,
      flat,
      nearestRelatives,
      familyMembers,
      previousEmployments,
      exServiceType,
      isExService,
    })
    // Lifecycle override (builder defaults to PENDING).
    payload.lifecycleStatus = lifecycle.lifecycleStatus

    // ── Write Guard + judicial cases atomically per row ──
    const created = await ctx.tx.guard.create({
      data: {
        ...(payload as Prisma.GuardCreateInput),
        ...(judicialCases.length > 0
          ? { judicialCases: { create: judicialCases } }
          : {}),
      },
    })

    // ── Side effects: service-history + status-history (fire-and-forget) ──
    void recordGuardServiceEvent({
      cnic: created.cnic,
      guardId: created.id,
      parwestId: created.parwestId,
      guardName: created.name,
      event: "ENROLLED",
      toStatus: created.status,
      description: `Guard enrolled via bulk import (job ${ctx.jobId})`,
      changedByName: null,
      regionName,
      officeName,
    })
    void recordGuardStatusChange({
      guardId: created.id,
      cnic: created.cnic,
      parwestId: created.parwestId,
      guardName: created.name,
      fromStatus: null,
      toStatus: created.status,
      reason: `Guard enrolled via bulk import (job ${ctx.jobId})`,
      changedByName: null,
      changedByType: "ENROLLMENT",
      regionName,
      officeName,
    })
  },
})
