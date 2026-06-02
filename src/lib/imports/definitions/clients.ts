/**
 * Clients bulk import — aligned with the interactive create path's contract.
 *
 * Storage / SoT guarantees enforced here (parity with POST /api/clients):
 *   - `Client.city` is ALWAYS derived from the row's region via
 *     `cityForRegionId()`. We do NOT accept a free-text `city` cell — the rest
 *     of the module hard-rejects client-supplied city to prevent region/city
 *     drift, and the import path must obey the same invariant.
 *   - Every row carries a `regionId`. Region-scoped lists rely on
 *     `buildManagerScopeWhere({ regionId })`; a region-less import would make
 *     bulk-created clients invisible to every regional admin (the bug audited
 *     in `docs/audits/clients-dead-legacy-conflict-audit.md` Top #3).
 *   - Phone/CNIC/email use the SHARED `@/lib/validation/formats` validators
 *     via the import-rules helpers (`requiredPhoneField`, `optionalCnicField`,
 *     `optionalEmailField`) — one regex for create form + edit form + import.
 *
 * Required-field deviations from `clientCreateSchema` (intentional, documented):
 *   - `enrollmentDate`: dropped. `Client.enrollmentDate` has a DB default of
 *     `now()`; the create form requires the user to pick a date, but for bulk
 *     ingestion (often historical data sets) we let the DB stamp it. Adding a
 *     column later is non-breaking.
 *   - `isBranchless`: forced to `true`. Bulk imports skip the branch-creation
 *     step, so imported rows are branchless by design (same behaviour the prior
 *     definition documented). Branches are added per-client afterwards.
 *   - `regionalOfficeId`, `assignedManagerId`, `assignedSupervisorId`:
 *     not exposed as import columns. Region alone is sufficient for scope; the
 *     finer assignments can be set per-client from the UI after import.
 *   - `contactNumbers[]` (additional phones): not exposed. The primary
 *     `contactNumber` covers the wizard's mandatory phone; secondary numbers
 *     can be added per-client from the edit form.
 *   - `clientLocation`, `clientPostalCode`, `contractUrl`, `ntn`, `strn`,
 *     `operationalProvinces`, `introducer*`: same shape as `clientCreateSchema`
 *     (optional in the wizard) — left as optional columns, with the same
 *     format checks (CNIC/PHONE) when supplied.
 *
 * Everything else (required `name`, `type`, `email` valid-format, required
 * `contactPerson`, required `contactNumber` PHONE_REGEX, required
 * `headOfficeAddress`) matches `clientCreateSchema` 1:1.
 */

import { z } from "zod"

import { prisma } from "@/lib/db"
import { cityForRegionId } from "@/lib/geo/regionCity"
import { provinceForBranch } from "@/lib/geo/province"
import { registerImport } from "@/lib/imports/registry"
import {
  memoizedResolver,
  optionalCnicField,
  optionalPhoneField,
  optionalString,
  requiredImportString,
  requiredPhoneField,
} from "@/lib/imports/rules"
import { coerceString, isSentinel } from "@/lib/imports/coerce"
import type { ColumnDescriptor } from "@/lib/imports/types"

/* ────────────────────────────────────────────────────────────────────── */
/* Header strings — sheet-side names                                       */
/* ────────────────────────────────────────────────────────────────────── */

const REQUIRED_HEADERS = [
  "name",
  "type",
  "region",
  "email",
  "contactPerson",
  "contactNumber",
  "headOfficeAddress",
] as const

const OPTIONAL_HEADERS = [
  "ntn",
  "strn",
  "operationalProvinces",
  "introducerName",
  "introducerContactNumber",
  "introducerCnic",
  "introducerAddress",
] as const

/* ────────────────────────────────────────────────────────────────────── */
/* Row schema — parity with clientCreateSchema (see file header for       */
/* deviations). Format helpers come from `@/lib/imports/rules`, which     */
/* re-exports the canonical PHONE_REGEX/CNIC_REGEX from                   */
/* `@/lib/validation/formats` — keep ONE regex per format across the      */
/* create form, edit form, and the import.                                 */
/* ────────────────────────────────────────────────────────────────────── */

const rowSchema = z.object({
  name: requiredImportString("Name", 200),
  type: requiredImportString("Client type", 64),
  // `region` is resolved by `regionResolver` BEFORE the schema runs; by the
  // time we see it, the cell holds the Region.id (or null on miss → the
  // engine has already attached a row error). We still require it as a
  // non-empty string so a blank region cell hard-fails the row instead of
  // silently slipping through as a region-less client (which would be
  // invisible to every region-scoped list).
  region: requiredImportString("Region", 64),
  email: requiredImportString("Email", 254).email(
    "Email must be a valid email address",
  ),
  contactPerson: requiredImportString("Contact person", 200),
  contactNumber: requiredPhoneField("Contact number"),
  headOfficeAddress: requiredImportString("Head office address", 500),
  // Optional fields — same format rules as the wizard when present.
  ntn: optionalString(64),
  strn: optionalString(64),
  operationalProvinces: optionalString(200),
  introducerName: optionalString(200),
  introducerAddress: optionalString(500),
  introducerCnic: optionalCnicField("Introducer CNIC"),
  introducerContactNumber: optionalPhoneField("Introducer contact"),
})

/**
 * Resolves a client type by canonical name (e.g. "BANK"). Names are
 * compared case-insensitively against `ClientType.name`. Returns the
 * stored canonical name (so `Client.type` matches existing rows).
 */
const clientTypeResolver = memoizedResolver<string>(
  "client.type",
  async (raw) => {
    const t = await prisma.clientType.findFirst({
      where: { name: { equals: raw.trim().toUpperCase(), mode: "insensitive" } },
      select: { name: true },
    })
    return t?.name ?? null
  },
)

/**
 * Resolves a region cell to `Region.id`. Accepts two forms with explicit
 * precedence:
 *   1. Region.id (cuid) — if the cell matches an existing id, that wins.
 *   2. Region.name — case-insensitive lookup (Region.name IS the operating
 *      city by convention, see `src/lib/geo/regionCity.ts`).
 * Returns null when neither matches; the engine surfaces that as a row error
 * with the rule's `message`, so the user knows which cell to fix.
 */
const regionResolver = memoizedResolver<string>("client.region", async (raw) => {
  const v = raw.trim()
  if (!v) return null
  // Id-first: tolerate uploads whose `region` column already carries a
  // Region.id (e.g. an export → re-import round-trip).
  const byId = await prisma.region.findUnique({ where: { id: v }, select: { id: true } })
  if (byId) return byId.id
  // Else look up by name (the operating-city convention).
  const byName = await prisma.region.findFirst({
    where: { name: { equals: v, mode: "insensitive" } },
    select: { id: true },
  })
  return byName?.id ?? null
})

registerImport({
  module: "clients",
  label: "Clients",
  description:
    "Bulk-create clients (no branches). Each row must include a region — city is derived server-side.",
  requiredHeaders: [...REQUIRED_HEADERS],
  optionalHeaders: [...OPTIONAL_HEADERS],
  rowSchema,
  referenceResolvers: { type: clientTypeResolver, region: regionResolver },
  columns: [
    { key: "name", header: "name", label: "Name", kind: "text", required: true },
    {
      key: "type",
      header: "type",
      label: "Client Type",
      kind: "fk",
      required: true,
      fkOptionsLoader: async (ctx) => {
        const rows = await ctx.prisma.clientType.findMany({
          select: { name: true },
          orderBy: { name: "asc" },
        })
        return rows.map((r) => ({ value: r.name, label: r.name }))
      },
    },
    {
      // FK combobox over Region — the option `value` is the Region.id so the
      // resolved cell matches the `region` resolver's id-first branch cleanly
      // (no extra name → id round-trip at persist time). `bulkApply` lets the
      // user set one region for the whole batch when ingesting a region-scoped
      // sheet (common case for regional admins).
      key: "region",
      header: "region",
      label: "Region",
      kind: "fk",
      required: true,
      bulkApply: true,
      fkOptionsLoader: async (ctx) => {
        const rows = await ctx.prisma.region.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
        return rows.map((r) => ({ value: r.id, label: r.name }))
      },
    },
    { key: "email", header: "email", label: "Email", kind: "text", required: true },
    { key: "contactPerson", header: "contactPerson", label: "Contact Person", kind: "text", required: true },
    { key: "contactNumber", header: "contactNumber", label: "Contact Number", kind: "phone", required: true },
    { key: "headOfficeAddress", header: "headOfficeAddress", label: "Head Office Address", kind: "text", required: true },
    { key: "ntn", header: "ntn", label: "NTN", kind: "text", required: false },
    { key: "strn", header: "strn", label: "STRN", kind: "text", required: false },
    { key: "operationalProvinces", header: "operationalProvinces", label: "Operational Provinces", kind: "text", required: false },
    { key: "introducerName", header: "introducerName", label: "Introducer Name", kind: "text", required: false },
    { key: "introducerContactNumber", header: "introducerContactNumber", label: "Introducer Contact", kind: "phone", required: false },
    { key: "introducerCnic", header: "introducerCnic", label: "Introducer CNIC", kind: "cnic", required: false },
    { key: "introducerAddress", header: "introducerAddress", label: "Introducer Address", kind: "text", required: false },
  ] satisfies ColumnDescriptor[],
  duplicates: [{ fields: ["name"], scope: "payload", message: "Duplicate client name in upload" }],
  sampleRows: [
    {
      name: "Client One",
      type: "BANK",
      region: "Lahore",
      email: "client.one@example.com",
      contactPerson: "Ali Khan",
      contactNumber: "+92-300-1234567",
      headOfficeAddress: "12 Mall Road, Lahore",
    },
    {
      name: "Client Two",
      type: "OTHER",
      region: "Karachi",
      email: "client.two@example.com",
      contactPerson: "Sara Ahmed",
      contactNumber: "+92-321-7654321",
      headOfficeAddress: "Plot 5, Clifton, Karachi",
    },
  ],
  persist: async (row, ctx) => {
    const r = row as {
      name: string
      type: string // resolved → canonical type name
      region: string // resolved → Region.id
      email: string
      contactPerson: string
      contactNumber: string
      headOfficeAddress: string
      ntn?: string
      strn?: string
      operationalProvinces?: string
      introducerName?: string
      introducerAddress?: string
      introducerCnic?: string
      introducerContactNumber?: string
    }

    const regionId = r.region
    // Derive city server-side from the region — Region.name IS the operating
    // city by convention (see `src/lib/geo/regionCity.ts`). This matches what
    // POST /api/clients does at line 135 and is the structural guarantee the
    // rest of the module depends on: a Client's `city` is NEVER user-supplied.
    const city = await cityForRegionId(ctx.tx, regionId)
    // Operational province is DERIVED from the home region (never the free-text
    // CSV cell), mirroring how `city` is handled — this keeps bulk imports within
    // the province↔region invariant enforced on the interactive paths (#47).
    const operationalProvince = await provinceForBranch(ctx.tx, { regionId })

    // Sentinel-safe optional pass-through. Optional columns survive zod as
    // their raw strings (or "" when blank); we coerce empty/sentinel → null
    // before writing so the row matches what the interactive path would store.
    const opt = (v: string | undefined): string | null => {
      if (v == null) return null
      const s = coerceString(v)
      return isSentinel(s) ? null : s
    }

    await ctx.tx.client.create({
      data: {
        name: r.name,
        type: r.type,
        regionId,
        city,
        email: r.email,
        contactPerson: r.contactPerson,
        phone: r.contactNumber,
        headOfficeAddress: r.headOfficeAddress,
        ntn: opt(r.ntn),
        strn: opt(r.strn),
        operationalProvinces: operationalProvince,
        introducerName: opt(r.introducerName),
        introducerAddress: opt(r.introducerAddress),
        introducerCnic: opt(r.introducerCnic),
        introducerContactNumber: opt(r.introducerContactNumber),
        status: "ACTIVE",
        // Bulk imports default to "branchless" so new rows don't sit in
        // limbo waiting for branches that may never be added. (Documented
        // deviation from `clientCreateSchema`, which lets the user choose.)
        isBranchless: true,
      },
    })
  },
})
