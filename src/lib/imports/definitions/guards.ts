import { z } from "zod"

import { prisma } from "@/lib/db"
import { registerImport } from "@/lib/imports/registry"
import { cnicField, memoizedResolver, optionalString, requiredString } from "@/lib/imports/rules"
import type { Prisma, PrismaClient } from "@prisma/client"

/**
 * Guards bulk import (top-level).
 *
 * Minimal create — name + CNIC required, parwestId is auto-generated
 * using the supplied regional-office series code (matches the
 * single-guard create flow at `POST /api/guards`). Richer per-guard
 * data should go through the dedicated enrolment form, not bulk.
 */
const rowSchema = z.object({
  name: requiredString("name", 200),
  cnic: cnicField(),
  phone: optionalString(32),
  regionalOfficeSeries: optionalString(8),
})

/** Resolves a RegionalOffice by `seriesCode`. Returns the RO id (string). */
const regionalOfficeResolver = memoizedResolver<string>(
  "guard.regionalOffice",
  async (raw) => {
    const code = raw.trim().toUpperCase()
    if (!code) return null
    const ro = await prisma.regionalOffice.findUnique({
      where: { seriesCode: code },
      select: { id: true },
    })
    return ro?.id ?? null
  },
)

/**
 * Generates the next available `parwestId` for the supplied office prefix.
 * Mirrors the logic in `POST /api/guards` so single + bulk converge on the
 * same numbering. Uses `findFirst({ orderBy: { parwestId: "desc" } })`
 * per the CLAUDE.md gotcha — do not revert to a `findMany` scan.
 */
async function generateNextParwestId(
  tx: PrismaClient | Prisma.TransactionClient,
  officeSeriesCode: string | null,
): Promise<string> {
  const prefix = officeSeriesCode ? `PW-${officeSeriesCode}` : "PW"
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`^${escapedPrefix}-(\\d+)$`)
  const latest = await tx.guard.findFirst({
    where: { parwestId: { startsWith: `${prefix}-` } },
    select: { parwestId: true },
    orderBy: { parwestId: "desc" },
  })
  let maxNumber = 0
  if (latest) {
    const match = latest.parwestId.match(pattern)
    if (match) {
      const numeric = Number(match[1])
      if (Number.isFinite(numeric)) maxNumber = numeric
    }
  }
  return `${prefix}-${String(maxNumber + 1).padStart(5, "0")}`
}

registerImport({
  module: "guards",
  label: "Guards",
  description: "Bulk-enrol guards (name + CNIC). Use sub-imports for richer data sets.",
  requiredHeaders: ["name", "cnic"],
  optionalHeaders: ["phone", "regionalOfficeSeries"],
  rowSchema,
  referenceResolvers: { regionalOfficeSeries: regionalOfficeResolver },
  duplicates: [
    {
      fields: ["cnic"],
      scope: "both",
      message: "CNIC already exists",
      existsInDb: async (values) => {
        const found = await prisma.guard.findUnique({
          where: { cnic: values.cnic },
          select: { id: true },
        })
        return Boolean(found)
      },
    },
  ],
  sampleRows: [
    { name: "Guard One", cnic: "35202-1234567-1", regionalOfficeSeries: "L" },
    { name: "Guard Two", cnic: "35202-7654321-1", regionalOfficeSeries: "K" },
  ],
  persist: async (row, ctx) => {
    const r = row as {
      name: string
      cnic: string
      phone?: string
      regionalOfficeSeries?: string // resolved → regionalOfficeId or empty
    }
    let regionalOfficeId: string | null = null
    let regionId: string | null = null
    let officeSeriesCode: string | null = null
    if (r.regionalOfficeSeries) {
      const ro = await ctx.tx.regionalOffice.findUnique({
        where: { id: r.regionalOfficeSeries },
        select: { id: true, regionId: true, seriesCode: true },
      })
      if (!ro) throw new Error("Regional office no longer exists")
      regionalOfficeId = ro.id
      regionId = ro.regionId
      officeSeriesCode = ro.seriesCode
    }
    const parwestId = await generateNextParwestId(ctx.tx, officeSeriesCode)
    await ctx.tx.guard.create({
      data: {
        parwestId,
        name: r.name,
        cnic: r.cnic,
        phone: r.phone ?? null,
        status: "PENDING",
        lifecycleStatus: "PENDING",
        regionId,
        regionalOfficeId,
      },
    })
  },
})
