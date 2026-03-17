import { prisma } from "@/lib/db"
import { getInventoryV2Flags } from "@/lib/inventory/v2-flags"

export const IMPORT_MODULES = ["users", "guards", "clients", "inventory"] as const
export type ImportModule = (typeof IMPORT_MODULES)[number]

export type ImportValidationError = {
  row: number
  field: string
  message: string
}

export type ImportValidationResult = {
  module: ImportModule
  headers: string[]
  totalRows: number
  validRows: number
  invalidRows: number
  valid: boolean
  errors: ImportValidationError[]
}

export type ImportJobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED"

export type ImportJobRecord = {
  jobId: string
  module: ImportModule
  status: ImportJobStatus
  createdAt: string
  updatedAt: string
  totalRows: number
  processedRows: number
  successRows: number
  failedRows: number
  validation: ImportValidationResult
  errors: ImportValidationError[]
}

type ImportPayload = {
  rows: Array<Record<string, unknown>>
  headers: string[]
}

const REQUIRED_FIELDS: Record<ImportModule, string[]> = {
  users: ["name", "email", "role", "regionalOfficeSeries", "contactNumber"],
  guards: ["name", "cnic"],
  clients: ["name", "type"],
  inventory: ["name"],
}

const globalStore = globalThis as unknown as {
  __importJobs?: Map<string, ImportJobRecord>
}

function jobsStore() {
  if (!globalStore.__importJobs) {
    globalStore.__importJobs = new Map<string, ImportJobRecord>()
  }
  return globalStore.__importJobs
}

function toImportModule(value: string): ImportModule | null {
  const normalized = value.trim().toLowerCase()
  return IMPORT_MODULES.includes(normalized as ImportModule) ? (normalized as ImportModule) : null
}

function normalizeKey(input: string) {
  return input.trim().replace(/\s+/g, "").replace(/[^a-zA-Z0-9_]/g, "")
}

function toStringValue(value: unknown) {
  if (value == null) return ""
  return String(value).trim()
}

function parseCsv(text: string): ImportPayload {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const rawHeaders = lines[0].split(",").map((header) => header.trim())
  const headers = rawHeaders.map(normalizeKey)
  const rows: Array<Record<string, unknown>> = []

  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(",")
    const row: Record<string, unknown> = {}
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = values[j]?.trim() ?? ""
    }
    rows.push(row)
  }

  return { headers, rows }
}

export async function readImportPayload(request: Request): Promise<ImportPayload> {
  const contentType = request.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return { rows: [], headers: [] }
    }
    const text = await file.text()
    return parseCsv(text)
  }

  const body = await request.json().catch(() => ({}))
  const rows = Array.isArray(body?.rows) ? body.rows : []
  const headersFromBody = Array.isArray(body?.headers) ? body.headers.map((header: unknown) => normalizeKey(String(header || ""))) : []
  const headers =
    headersFromBody.length > 0
      ? headersFromBody
      : rows.length > 0
        ? Object.keys(rows[0] as Record<string, unknown>).map(normalizeKey)
        : []

  const normalizedRows = rows.map((row: Record<string, unknown>) => {
    const normalized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row || {})) {
      normalized[normalizeKey(key)] = value
    }
    return normalized
  })

  return { rows: normalizedRows, headers }
}

export function validateImport(moduleName: string, payload: ImportPayload): ImportValidationResult | null {
  const importModule = toImportModule(moduleName)
  if (!importModule) return null

  const rows = payload.rows || []
  const headers = payload.headers || []
  const requiredFields = REQUIRED_FIELDS[importModule]
  const errors: ImportValidationError[] = []
  let validRows = 0

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowErrors: ImportValidationError[] = []
    if (importModule === "inventory") {
      const hasLegacyShape = Boolean(toStringValue(row.name) && toStringValue(row.category))
      const hasV2Shape = Boolean(toStringValue(row.sku) && toStringValue(row.name) && toStringValue(row.storeCode))

      if (!hasLegacyShape && !hasV2Shape) {
        rowErrors.push({
          row: index + 2,
          field: "inventory",
          message: "Inventory row must include either legacy shape (name, category) or v2 shape (sku, name, storeCode).",
        })
      }

      const qtyText = toStringValue(row.quantity || row.quantityOnHand)
      if (qtyText && !/^-?\d+(\.\d+)?$/.test(qtyText)) {
        rowErrors.push({
          row: index + 2,
          field: "quantity",
          message: "Quantity must be numeric when provided.",
        })
      }
    } else {
      for (const field of requiredFields) {
        if (!toStringValue(row[field])) {
          rowErrors.push({
            row: index + 2,
            field,
            message: `Missing required field: ${field}`,
          })
        }
      }
    }

    if (importModule === "users" && row.email && !toStringValue(row.email).includes("@")) {
      rowErrors.push({ row: index + 2, field: "email", message: "Invalid email format" })
    }
    if (importModule === "guards" && row.cnic && !/^[0-9\-]+$/.test(toStringValue(row.cnic))) {
      rowErrors.push({ row: index + 2, field: "cnic", message: "Invalid CNIC format" })
    }

    if (rowErrors.length === 0) validRows += 1
    errors.push(...rowErrors)
  }

  return {
    module: importModule,
    headers,
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
    valid: errors.length === 0,
    errors,
  }
}

export function createImportJob(module: ImportModule, validation: ImportValidationResult): ImportJobRecord {
  const now = new Date().toISOString()
  const jobId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const job: ImportJobRecord = {
    jobId,
    module,
    status: validation.valid ? "COMPLETED" : "FAILED",
    createdAt: now,
    updatedAt: now,
    totalRows: validation.totalRows,
    processedRows: validation.totalRows,
    successRows: validation.validRows,
    failedRows: validation.invalidRows,
    validation,
    errors: validation.errors,
  }
  jobsStore().set(jobId, job)
  return job
}

function finalizeImportJob(
  module: ImportModule,
  validation: ImportValidationResult,
  processedRows: number,
  successRows: number,
  failedRows: number,
  errors: ImportValidationError[]
) {
  const now = new Date().toISOString()
  const jobId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const job: ImportJobRecord = {
    jobId,
    module,
    status: failedRows > 0 ? "FAILED" : "COMPLETED",
    createdAt: now,
    updatedAt: now,
    totalRows: validation.totalRows,
    processedRows,
    successRows,
    failedRows,
    validation,
    errors,
  }
  jobsStore().set(jobId, job)
  return job
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toSlug(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
}

async function processInventoryRows(validation: ImportValidationResult, rows: Array<Record<string, unknown>>) {
  const flags = getInventoryV2Flags()
  const errors: ImportValidationError[] = [...validation.errors]

  if (!flags.writeEnabled) {
    errors.push({
      row: 1,
      field: "inventory.v2.writeEnabled",
      message: "Inventory v2 write flag is disabled. Enable INVENTORY_V2_WRITE_ENABLED=true before processing imports.",
    })
    return finalizeImportJob("inventory", validation, 0, 0, validation.totalRows, errors)
  }

  let successRows = 0
  let failedRows = 0
  let processedRows = 0

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNo = index + 2
    processedRows += 1

    try {
      const name = toStringValue(row.name)
      if (!name) throw new Error("Missing name")

      const sku = toStringValue(row.sku) || `LEG-${toSlug(name)}-${index + 1}`
      const storeCode = toStringValue(row.storeCode) || "RO-UNASSIGNED"
      const storeName = toStringValue(row.storeName) || `${storeCode} Imported Store`
      const quantityOnHand = Math.max(0, Math.round(toNumber(row.quantityOnHand ?? row.quantity, 0)))
      const avgUnitCostRaw = toNumber(row.avgUnitCost ?? row.unitCost, 0)
      const avgUnitCost = avgUnitCostRaw > 0 ? avgUnitCostRaw : null
      const brandName = toStringValue(row.brand)
      const unitName = toStringValue(row.unit)
      const statusName = toStringValue(row.status) || "ACTIVE"

      await prisma.$transaction(async (tx) => {
        const store = await tx.store.upsert({
          where: { code: storeCode },
          create: {
            code: storeCode,
            name: storeName,
            type: "IMPORTED",
            isActive: true,
          },
          update: {
            name: storeName,
            isActive: true,
          },
        })

        const brand = brandName
          ? await tx.storeInventoryBrand.upsert({
              where: { name: brandName },
              create: { name: brandName },
              update: {},
            })
          : null

        const unit = unitName
          ? await tx.storeInventoryUnit.upsert({
              where: { name: unitName },
              create: {
                name: unitName,
                shortCode: toSlug(unitName).slice(0, 8) || "UNIT",
              },
              update: {},
            })
          : null

        const status = await tx.storeInventoryStatus.upsert({
          where: { name: statusName },
          create: { name: statusName },
          update: {},
        })

        const product = await tx.storeInventoryProduct.upsert({
          where: { sku },
          create: {
            sku,
            name,
            brandId: brand?.id ?? null,
            unitId: unit?.id ?? null,
            statusId: status.id,
            serialRequired: false,
          },
          update: {
            name,
            brandId: brand?.id ?? null,
            unitId: unit?.id ?? null,
            statusId: status.id,
          },
        })

        await tx.storeInventoryBalance.upsert({
          where: {
            storeId_productId: {
              storeId: store.id,
              productId: product.id,
            },
          },
          create: {
            storeId: store.id,
            productId: product.id,
            quantityOnHand,
            avgUnitCost,
          },
          update: {
            quantityOnHand,
            avgUnitCost,
          },
        })
      })

      successRows += 1
    } catch (error) {
      failedRows += 1
      errors.push({
        row: rowNo,
        field: "inventory",
        message: error instanceof Error ? error.message : "Failed to process inventory row.",
      })
    }
  }

  return finalizeImportJob("inventory", validation, processedRows, successRows, failedRows, errors)
}

export async function processImport(
  module: ImportModule,
  payload: { rows: Array<Record<string, unknown>>; headers: string[] },
  validation: ImportValidationResult
) {
  if (module !== "inventory") {
    return createImportJob(module, validation)
  }

  return processInventoryRows(validation, payload.rows)
}

export function getImportJob(jobId: string) {
  return jobsStore().get(jobId) || null
}

export function toErrorCsv(errors: ImportValidationError[]) {
  const header = "row,field,message"
  const lines = errors.map((error) => `${error.row},${error.field},"${String(error.message).replaceAll('"', '""')}"`)
  return [header, ...lines].join("\n")
}
