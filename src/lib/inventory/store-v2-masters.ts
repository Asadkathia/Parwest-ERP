import { prisma } from "@/lib/db"

export type StoreV2MasterResource =
  | "stores"
  | "vendors"
  | "categories"
  | "brands"
  | "units"
  | "statuses"
  | "conditions"
  | "weapon-types"
  | "calibres"
  | "license-types"
  | "variations"
  | "repairings"

export type MasterResourceConfig = {
  delegate: {
    findMany: (...args: unknown[]) => Promise<unknown>
    findUnique: (...args: unknown[]) => Promise<unknown>
    create: (...args: unknown[]) => Promise<unknown>
    update: (...args: unknown[]) => Promise<unknown>
    delete: (...args: unknown[]) => Promise<unknown>
  }
  orderBy: Record<string, "asc" | "desc">
  include?: Record<string, boolean>
  buildCreateData: (body: Record<string, unknown>) => Record<string, unknown>
  buildUpdateData: (body: Record<string, unknown>) => Record<string, unknown>
}

const baseNameCreate = (body: Record<string, unknown>) => ({
  name: String(body.name ?? "").trim(),
})

const baseNameUpdate = (body: Record<string, unknown>) => {
  const next: Record<string, unknown> = {}
  if (body.name != null) next.name = String(body.name).trim()
  return next
}

const storesConfig: MasterResourceConfig = {
  delegate: prisma.store as unknown as MasterResourceConfig["delegate"],
  orderBy: { name: "asc" },
  include: { regionalOffice: true },
  buildCreateData: (body) => ({
    code: String(body.code ?? "").trim(),
    name: String(body.name ?? "").trim(),
    type: body.type ? String(body.type).trim() : null,
    address: body.address ? String(body.address).trim() : null,
    contactNumber: body.contactNumber ? String(body.contactNumber).trim() : null,
    isActive: body.isActive == null ? true : Boolean(body.isActive),
    regionalOfficeId: body.regionalOfficeId ? String(body.regionalOfficeId).trim() : null,
  }),
  buildUpdateData: (body) => {
    const next: Record<string, unknown> = {}
    if (body.code != null) next.code = String(body.code).trim()
    if (body.name != null) next.name = String(body.name).trim()
    if (body.type != null) next.type = body.type ? String(body.type).trim() : null
    if (body.address != null) next.address = body.address ? String(body.address).trim() : null
    if (body.contactNumber != null) {
      next.contactNumber = body.contactNumber ? String(body.contactNumber).trim() : null
    }
    if (body.isActive != null) next.isActive = Boolean(body.isActive)
    if (body.regionalOfficeId != null) {
      next.regionalOfficeId = body.regionalOfficeId ? String(body.regionalOfficeId).trim() : null
    }
    return next
  },
}

const masters: Record<StoreV2MasterResource, MasterResourceConfig> = {
  stores: storesConfig,
  vendors: {
    delegate: prisma.inventoryVendor as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: (body) => ({
      name: String(body.name ?? "").trim(),
      contact: body.contact ? String(body.contact).trim() : null,
    }),
    buildUpdateData: (body) => {
      const next: Record<string, unknown> = {}
      if (body.name != null) next.name = String(body.name).trim()
      if (body.contact != null) next.contact = body.contact ? String(body.contact).trim() : null
      return next
    },
  },
  categories: {
    delegate: prisma.inventoryCategory as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: baseNameCreate,
    buildUpdateData: baseNameUpdate,
  },
  brands: {
    delegate: prisma.storeInventoryBrand as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: baseNameCreate,
    buildUpdateData: baseNameUpdate,
  },
  units: {
    delegate: prisma.storeInventoryUnit as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: (body) => ({
      name: String(body.name ?? "").trim(),
      shortCode: String(body.shortCode ?? "").trim(),
    }),
    buildUpdateData: (body) => {
      const next: Record<string, unknown> = {}
      if (body.name != null) next.name = String(body.name).trim()
      if (body.shortCode != null) next.shortCode = String(body.shortCode).trim()
      return next
    },
  },
  statuses: {
    delegate: prisma.storeInventoryStatus as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: baseNameCreate,
    buildUpdateData: baseNameUpdate,
  },
  conditions: {
    delegate: prisma.storeInventoryConditionV2 as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: (body) => ({
      name: String(body.name ?? "").trim(),
      description: body.description ? String(body.description).trim() : null,
    }),
    buildUpdateData: (body) => {
      const next: Record<string, unknown> = {}
      if (body.name != null) next.name = String(body.name).trim()
      if (body.description != null) {
        next.description = body.description ? String(body.description).trim() : null
      }
      return next
    },
  },
  "weapon-types": {
    delegate: prisma.storeInventoryWeaponType as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: baseNameCreate,
    buildUpdateData: baseNameUpdate,
  },
  calibres: {
    delegate: prisma.storeInventoryCalibre as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: baseNameCreate,
    buildUpdateData: baseNameUpdate,
  },
  "license-types": {
    delegate: prisma.storeInventoryLicenseType as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: baseNameCreate,
    buildUpdateData: baseNameUpdate,
  },
  variations: {
    delegate: prisma.storeInventoryVariation as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: baseNameCreate,
    buildUpdateData: baseNameUpdate,
  },
  repairings: {
    delegate: prisma.storeInventoryRepairing as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    buildCreateData: baseNameCreate,
    buildUpdateData: baseNameUpdate,
  },
}

export function isValidMasterResource(resource: string): resource is StoreV2MasterResource {
  return resource in masters
}

export function getMasterConfig(resource: StoreV2MasterResource): MasterResourceConfig {
  return masters[resource]
}
