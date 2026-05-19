import { z } from "zod"

import { prisma } from "@/lib/db"
import { registerImport } from "@/lib/imports/registry"
import { memoizedResolver, optionalString, requiredString } from "@/lib/imports/rules"
import type { ColumnDescriptor } from "@/lib/imports/types"

const rowSchema = z.object({
  name: requiredString("name", 200),
  type: requiredString("type", 64),
  city: optionalString(120),
  email: optionalString(254),
  phone: optionalString(32),
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

registerImport({
  module: "clients",
  label: "Clients",
  description: "Bulk-create clients (no branches). Branches are added per-client.",
  requiredHeaders: ["name", "type"],
  optionalHeaders: ["city", "email", "phone"],
  rowSchema,
  referenceResolvers: { type: clientTypeResolver },
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
    { key: "city", header: "city", label: "City", kind: "text", required: false },
    { key: "email", header: "email", label: "Email", kind: "text", required: false },
    { key: "phone", header: "phone", label: "Phone", kind: "text", required: false },
  ] satisfies ColumnDescriptor[],
  duplicates: [{ fields: ["name"], scope: "payload", message: "Duplicate client name in upload" }],
  sampleRows: [
    { name: "Client One", type: "BANK", city: "Lahore" },
    { name: "Client Two", type: "OTHER", city: "Karachi" },
  ],
  persist: async (row, ctx) => {
    const r = row as {
      name: string
      type: string // resolved → canonical type name
      city?: string
      email?: string
      phone?: string
    }
    await ctx.tx.client.create({
      data: {
        name: r.name,
        type: r.type,
        city: r.city ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        status: "ACTIVE",
        // Bulk imports default to "branchless" so new rows don't sit in
        // limbo waiting for branches that may never be added.
        isBranchless: true,
      },
    })
  },
})
