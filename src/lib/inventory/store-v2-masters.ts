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

function generateStoreCode(type: unknown): string {
  const prefix = normalizeStoreType(type) === "WAREHOUSE" ? "WH" : "ST"
  const stamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${stamp}-${random}`
}

function normalizeStoreType(value: unknown): "STORE" | "WAREHOUSE" {
  const raw = String(value ?? "").trim().toUpperCase()
  if (raw === "WAREHOUSE") return "WAREHOUSE"
  if (raw === "STORE") return "STORE"
  // Default to STORE for non-normalized legacy values.
  return "STORE"
}

const storesConfig: MasterResourceConfig = {
  delegate: prisma.store as unknown as MasterResourceConfig["delegate"],
  orderBy: { name: "asc" },
  include: { regionalOffice: true },
  buildCreateData: (body) => {
    const type = normalizeStoreType(body.type)
    const inputCode = String(body.code ?? "").trim()

    return {
      code: inputCode || generateStoreCode(type),
      name: String(body.name ?? "").trim(),
      type,
      prefix: body.prefix ? String(body.prefix).trim() : null,
      isHeadOffice: body.isHeadOffice === true,
      latitude: body.latitude != null ? Number(body.latitude) : null,
      longitude: body.longitude != null ? Number(body.longitude) : null,
      address: body.address ? String(body.address).trim() : null,
      contactNumber: body.contactNumber ? String(body.contactNumber).trim() : null,
      isActive: body.isActive == null ? true : Boolean(body.isActive),
      regionalOfficeId: body.regionalOfficeId ? String(body.regionalOfficeId).trim() : null,
    }
  },
  buildUpdateData: (body) => {
    const next: Record<string, unknown> = {}
    if (body.code != null) next.code = String(body.code).trim()
    if (body.name != null) next.name = String(body.name).trim()
    if (body.type != null) next.type = normalizeStoreType(body.type)
    if (body.prefix != null) next.prefix = body.prefix ? String(body.prefix).trim() : null
    if (body.isHeadOffice != null) next.isHeadOffice = Boolean(body.isHeadOffice)
    if (body.latitude != null) next.latitude = Number(body.latitude)
    if (body.longitude != null) next.longitude = Number(body.longitude)
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
      companyPhone: body.companyPhone ? String(body.companyPhone).trim() : null,
      contactPerson: body.contactPerson ? String(body.contactPerson).trim() : null,
      contactPersonPhone: body.contactPersonPhone ? String(body.contactPersonPhone).trim() : null,
      address: body.address ? String(body.address).trim() : null,
    }),
    buildUpdateData: (body) => {
      const next: Record<string, unknown> = {}
      if (body.name != null) next.name = String(body.name).trim()
      if (body.contact != null) next.contact = body.contact ? String(body.contact).trim() : null
      if (body.companyPhone != null) {
        next.companyPhone = body.companyPhone ? String(body.companyPhone).trim() : null
      }
      if (body.contactPerson != null) {
        next.contactPerson = body.contactPerson ? String(body.contactPerson).trim() : null
      }
      if (body.contactPersonPhone != null) {
        next.contactPersonPhone = body.contactPersonPhone
          ? String(body.contactPersonPhone).trim()
          : null
      }
      if (body.address != null) next.address = body.address ? String(body.address).trim() : null
      return next
    },
  },
  categories: {
    delegate: prisma.storeInventoryCategory as unknown as MasterResourceConfig["delegate"],
    orderBy: { name: "asc" },
    include: { parent: true },
    buildCreateData: (body) => ({
      name: String(body.name ?? "").trim(),
      parentId: body.parentId ? String(body.parentId).trim() : null,
      canAssignGuard: body.canAssignGuard === true,
      canAssignEmployee: body.canAssignEmployee === true,
      canAssignClient: body.canAssignClient === true,
    }),
    buildUpdateData: (body) => {
      const next: Record<string, unknown> = {}
      if (body.name != null) next.name = String(body.name).trim()
      if (body.parentId != null) next.parentId = body.parentId ? String(body.parentId).trim() : null
      if (body.canAssignGuard != null) next.canAssignGuard = body.canAssignGuard === true
      if (body.canAssignEmployee != null) next.canAssignEmployee = body.canAssignEmployee === true
      if (body.canAssignClient != null) next.canAssignClient = body.canAssignClient === true
      return next
    },
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
    include: { category: true },
    buildCreateData: (body) => ({
      name: String(body.name ?? "").trim(),
      categoryId: body.categoryId ? String(body.categoryId).trim() : null,
    }),
    buildUpdateData: (body) => {
      const next: Record<string, unknown> = {}
      if (body.name != null) next.name = String(body.name).trim()
      if (body.categoryId != null) next.categoryId = body.categoryId ? String(body.categoryId).trim() : null
      return next
    },
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
