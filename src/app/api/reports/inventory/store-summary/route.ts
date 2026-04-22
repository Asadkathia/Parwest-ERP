import { auth } from "@/lib/auth"
import { hasModuleAccess } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { csvDownload, parseReportFormat, toCsv } from "@/lib/reports/utils"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "REPORTS")) return forbidden()

    const managerScope = deriveManagerScope(session)
    const url = new URL(request.url)

    const format = parseReportFormat(url.searchParams.get("format"))
    const storeId = url.searchParams.get("storeId")?.trim() || undefined
    const productId = url.searchParams.get("productId")?.trim() || undefined
    const regionalOfficeId = url.searchParams.get("regionalOfficeId")?.trim() || undefined
    const search = url.searchParams.get("search")?.trim() || undefined

    if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: regionalOfficeId || null })) {
      return forbidden("Forbidden: report scope is outside your assignment.")
    }

    const rows = await prisma.storeInventoryBalance.findMany({
      where: {
        storeId,
        productId,
        store: {
          ...(regionalOfficeId ? { regionalOfficeId } : {}),
          ...(managerScope?.regionalOfficeIds?.length
            ? { regionalOfficeId: { in: managerScope.regionalOfficeIds } }
            : {}),
          ...(managerScope?.regionId
            ? {
                regionalOffice: {
                  regionId: managerScope.regionId,
                },
              }
            : {}),
        },
        ...(search
          ? {
              OR: [
                { product: { name: { contains: search, mode: "insensitive" } } },
                { product: { sku: { contains: search, mode: "insensitive" } } },
                { store: { name: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        store: {
          include: {
            regionalOffice: {
              include: {
                region: true,
              },
            },
          },
        },
        product: {
          include: {
            brand: true,
            unit: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    })

    const mapped = rows.map((row) => ({
      balanceId: row.id,
      storeId: row.storeId,
      storeCode: row.store.code,
      storeName: row.store.name,
      regionalOffice: row.store.regionalOffice?.name || "",
      region: row.store.regionalOffice?.region?.name || "",
      productId: row.productId,
      sku: row.product.sku,
      productName: row.product.name,
      brand: row.product.brand?.name || "",
      unit: row.product.unit?.name || "",
      status: row.product.status?.name || "",
      quantityOnHand: row.quantityOnHand,
      quantityHeld: row.quantityHeld,
      quantityIssued: row.quantityIssued,
      avgUnitCost: row.avgUnitCost ?? 0,
      inventoryValue: Number(((row.avgUnitCost ?? 0) * row.quantityOnHand).toFixed(2)),
      updatedAt: row.updatedAt.toISOString(),
    }))

    if (format === "csv") {
      const csv = toCsv(mapped, [
        { key: "storeCode", label: "Store Code" },
        { key: "storeName", label: "Store" },
        { key: "regionalOffice", label: "Regional Office" },
        { key: "region", label: "Region" },
        { key: "sku", label: "SKU" },
        { key: "productName", label: "Product" },
        { key: "brand", label: "Brand" },
        { key: "unit", label: "Unit" },
        { key: "status", label: "Status" },
        { key: "quantityOnHand", label: "On Hand" },
        { key: "quantityHeld", label: "Held" },
        { key: "quantityIssued", label: "Issued" },
        { key: "avgUnitCost", label: "Avg Unit Cost" },
        { key: "inventoryValue", label: "Inventory Value" },
        { key: "updatedAt", label: "Updated At" },
      ])
      return csvDownload("store-inventory-summary-report.csv", csv)
    }

    const summary = {
      stores: new Set(mapped.map((row) => row.storeId)).size,
      products: new Set(mapped.map((row) => row.productId)).size,
      rows: mapped.length,
      totalOnHand: mapped.reduce((sum, row) => sum + row.quantityOnHand, 0),
      totalHeld: mapped.reduce((sum, row) => sum + row.quantityHeld, 0),
      totalIssued: mapped.reduce((sum, row) => sum + row.quantityIssued, 0),
      totalInventoryValue: Number(mapped.reduce((sum, row) => sum + row.inventoryValue, 0).toFixed(2)),
    }

    return ok({
      report: "inventory.store-summary",
      filters: {
        storeId: storeId || null,
        productId: productId || null,
        regionalOfficeId: regionalOfficeId || null,
        search: search || null,
      },
      summary,
      rows: mapped,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.includes("Unknown argument `regionalOffice`")) {
      return badRequest("Invalid regional office scope. Ensure regional office relations are configured.")
    }

    console.error("Error generating store inventory summary report:", error)
    return internalServerError("Failed to generate store inventory summary report.")
  }
}
