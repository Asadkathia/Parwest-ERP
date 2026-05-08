import bcrypt from "bcryptjs"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { registerImport } from "@/lib/imports/registry"
import { memoizedResolver, optionalString, requiredString } from "@/lib/imports/rules"

/**
 * Users bulk import.
 *
 * Resolves Role by name + RegionalOffice by `seriesCode` (e.g. "L" →
 * Lahore RO), hashes the password, then creates a User row. Mirrors
 * the single-user path in `POST /api/users` (bcrypt cost 12, role
 * scope check via `Role.scopeType`).
 */
const rowSchema = z.object({
  name: requiredString("name", 200),
  email: requiredString("email", 254).email("email must be a valid address"),
  role: requiredString("role", 100),
  regionalOfficeSeries: requiredString("regionalOfficeSeries", 32),
  contactNumber: requiredString("contactNumber", 32),
  password: optionalString(64),
})

/** Resolves a Role row by name (case-insensitive). Returns the role id. */
const roleResolver = memoizedResolver<string>("user.role", async (raw) => {
  const role = await prisma.role.findFirst({
    where: { name: { equals: raw.trim(), mode: "insensitive" } },
    select: { id: true },
  })
  return role?.id ?? null
})

/** Resolves a RegionalOffice by `seriesCode` (e.g. "L"). Returns the RO id. */
const regionalOfficeResolver = memoizedResolver<string>(
  "user.regionalOffice",
  async (raw) => {
    const ro = await prisma.regionalOffice.findUnique({
      where: { seriesCode: raw.trim().toUpperCase() },
      select: { id: true },
    })
    return ro?.id ?? null
  },
)

/**
 * Default password used when the upload omits one. Matches the legacy
 * onboarding rule "force change on first login" — paired with a future
 * `mustChangePassword` flag we'd add to User. Until that exists, the
 * imported users get this seed and IT communicates it manually.
 */
const DEFAULT_IMPORT_PASSWORD = "Parwest@1234"

registerImport({
  module: "users",
  label: "Users",
  description: "Bulk-create staff users with role + regional-office mapping.",
  requiredHeaders: ["name", "email", "role", "regionalOfficeSeries", "contactNumber"],
  optionalHeaders: ["password"],
  rowSchema,
  sampleRows: [
    {
      name: "Ali Khan",
      email: "ali@example.com",
      role: "Manager",
      regionalOfficeSeries: "L",
      contactNumber: "03001234567",
    },
    {
      name: "Sara Malik",
      email: "sara@example.com",
      role: "Supervisor",
      regionalOfficeSeries: "K",
      contactNumber: "03007654321",
    },
  ],
  referenceResolvers: {
    role: roleResolver,
    regionalOfficeSeries: regionalOfficeResolver,
  },
  duplicates: [
    {
      fields: ["email"],
      scope: "both",
      message: "Email already exists",
      existsInDb: async (values) => {
        const found = await prisma.user.findUnique({
          where: { email: values.email },
          select: { id: true },
        })
        return Boolean(found)
      },
    },
  ],
  persist: async (row, ctx) => {
    const r = row as {
      name: string
      email: string
      role: string // resolved → roleId
      regionalOfficeSeries: string // resolved → regionalOfficeId
      contactNumber: string
      password?: string
    }
    // Look up the role's scopeType to set regionId correctly. Regional
    // roles must have both regionId + regionalOfficeId; global roles must
    // not. Mirrors the single-user POST path.
    const role = await ctx.tx.role.findUnique({
      where: { id: r.role },
      select: { scopeType: true, name: true },
    })
    if (!role) throw new Error("Role no longer exists")

    let regionId: string | null = null
    let regionalOfficeId: string | null = null
    if (role.scopeType === "REGIONAL") {
      const ro = await ctx.tx.regionalOffice.findUnique({
        where: { id: r.regionalOfficeSeries },
        select: { id: true, regionId: true },
      })
      if (!ro) throw new Error("Regional office no longer exists")
      regionalOfficeId = ro.id
      regionId = ro.regionId
    }
    // Global roles ignore regionalOfficeSeries even if supplied — matches
    // the single-user path which rejects it. We silently drop here so a
    // sheet with a single seriesCode column for everyone still imports.

    const password = r.password?.trim() || DEFAULT_IMPORT_PASSWORD
    const hashed = await bcrypt.hash(password, 12)

    await ctx.tx.user.create({
      data: {
        name: r.name,
        email: r.email,
        password: hashed,
        roleId: r.role,
        contactNumber: r.contactNumber,
        regionId,
        regionalOfficeId,
        status: "ACTIVE",
      },
    })
  },
})
