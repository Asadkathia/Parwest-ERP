"use client"

import { useCallback, useEffect, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertCircle } from "lucide-react"

import { DataTable } from "@/components/shadcn/data-table"
import { Card, CardContent } from "@/components/shadcn/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import { Button } from "@/components/shadcn/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import { apiGet } from "@/components/store-inventory-v2/api"
import { useScopeQuery } from "@/components/store-inventory-v2/use-scope-query"

type Option = { id: string; name: string }
type RegionOption = { id: string; name: string }
type InventoryCategoryScope = "NON_WEAPON" | "WEAPON" | "AMMO"

type Row = {
  id: string
  quantityOnHand: number
  quantityHeld: number
  quantityIssued: number
  avgUnitCost?: number | null
  updatedAt: string
  store: { id: string; name: string }
  product: {
    id: string
    sku: string
    name: string
    variation?: { id: string; name: string } | null
    category?: { id: string; name: string } | null
  }
}

const ALL_VALUE = "__all__"

export default function InventoriesManager({
  categoryScope = "NON_WEAPON",
  regions: _regions = [],
  locked: _locked = false,
}: {
  categoryScope?: InventoryCategoryScope
  regions?: RegionOption[]
  locked?: boolean
}) {
  void _regions
  void _locked
  // Server-side scoping preserved verbatim — DO NOT touch.
  const scopeQuery = useScopeQuery()
  const [rows, setRows] = useState<Row[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [products, setProducts] = useState<Option[]>([])
  const [variants, setVariants] = useState<Option[]>([])
  const [storeId, setStoreId] = useState("")
  const [productId, setProductId] = useState("")
  const [variantId, setVariantId] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (storeId) params.set("storeId", storeId)
      if (productId) params.set("productId", productId)
      if (variantId) params.set("variationId", variantId)
      params.set("categoryScope", categoryScope)
      params.set("includeZero", "true")
      if (scopeQuery.regionId) params.set("regionId", scopeQuery.regionId)
      if (scopeQuery.regionalOfficeId)
        params.set("regionalOfficeId", scopeQuery.regionalOfficeId)

      const [data, storeRows, productRows] = await Promise.all([
        apiGet<Row[]>(`/api/store-inventory/v2/inventories?${params.toString()}`),
        apiGet<Option[]>(`/api/store-inventory/v2/masters/stores${scopeQuery.query}`),
        apiGet<
          Array<{
            id: string
            sku: string
            name: string
            category?: { id: string; name: string } | null
            variation?: { id: string; name: string } | null
          }>
        >("/api/store-inventory/v2/products"),
      ])
      setRows(data)
      setStores(storeRows)
      const filteredProducts = productRows.filter((row) => {
        const category = String(row.category?.name ?? "").toLowerCase()
        if (categoryScope === "WEAPON") return category.includes("weapon")
        if (categoryScope === "AMMO") return category.includes("ammo")
        return !category.includes("weapon") && !category.includes("ammo")
      })
      setProducts(
        filteredProducts.map((row) => ({ id: row.id, name: `${row.sku} - ${row.name}` })),
      )

      const uniqueVariants = new Map<string, string>()
      for (const row of filteredProducts) {
        if (row.variation?.id && row.variation?.name)
          uniqueVariants.set(row.variation.id, row.variation.name)
      }
      setVariants(
        Array.from(uniqueVariants.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load balances."
      setErrorMessage(message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [
    categoryScope,
    productId,
    storeId,
    variantId,
    scopeQuery.query,
    scopeQuery.regionId,
    scopeQuery.regionalOfficeId,
  ])

  useEffect(() => {
    void load()
  }, [load])

  const clearFilters = () => {
    setStoreId("")
    setProductId("")
    setVariantId("")
  }

  const title =
    categoryScope === "WEAPON"
      ? "Weapon Inventories"
      : categoryScope === "AMMO"
        ? "Ammo Inventories"
        : "Inventories"

  const columns: ColumnDef<Row>[] = [
    {
      id: "store",
      header: "Store",
      accessorFn: (row) => row.store.name,
      cell: ({ row }) => row.original.store.name,
    },
    {
      id: "product",
      header: "Product",
      accessorFn: (row) => `${row.product.sku} ${row.product.name}`,
      cell: ({ row }) => (
        <span>
          <span className="font-mono text-xs text-muted-foreground">{row.original.product.sku}</span>{" "}
          <span className="font-medium">{row.original.product.name}</span>
        </span>
      ),
    },
    {
      id: "variant",
      header: "Variant",
      accessorFn: (row) => row.product.variation?.name || "—",
    },
    {
      id: "category",
      header: "Category",
      accessorFn: (row) => row.product.category?.name || "—",
    },
    {
      id: "quantityOnHand",
      accessorKey: "quantityOnHand",
      header: () => <span className="block text-end">Available</span>,
      cell: ({ row }) => (
        <span className="block text-end tabular-nums">{row.original.quantityOnHand}</span>
      ),
    },
    {
      id: "quantityHeld",
      accessorKey: "quantityHeld",
      header: () => <span className="block text-end">Reusable</span>,
      cell: ({ row }) => (
        <span className="block text-end tabular-nums">{row.original.quantityHeld}</span>
      ),
    },
    {
      id: "quantityIssued",
      accessorKey: "quantityIssued",
      header: () => <span className="block text-end">Assigned</span>,
      cell: ({ row }) => (
        <span className="block text-end tabular-nums">{row.original.quantityIssued}</span>
      ),
    },
    {
      id: "totalQty",
      header: () => <span className="block text-end">Total</span>,
      accessorFn: (row) => row.quantityOnHand + row.quantityHeld + row.quantityIssued,
      cell: ({ row }) => (
        <span className="block text-end font-semibold tabular-nums">
          {row.original.quantityOnHand + row.original.quantityHeld + row.original.quantityIssued}
        </span>
      ),
    },
    {
      id: "avgUnitCost",
      header: () => <span className="block text-end">Avg Cost</span>,
      cell: ({ row }) =>
        row.original.avgUnitCost == null ? (
          <span className="block text-end text-muted-foreground">—</span>
        ) : (
          <span className="block text-end">
            <ParwestCurrency value={row.original.avgUnitCost} />
          </span>
        ),
    },
    {
      id: "updatedAt",
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString("en-US"),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground -mt-4">
        Store-wise quantity view for available/reusable/issued stock.
      </p>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-6 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Store</label>
            <Select
              value={storeId || ALL_VALUE}
              onValueChange={(value) => setStoreId(value === ALL_VALUE ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All stores</SelectItem>
                {stores.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Product</label>
            <Select
              value={productId || ALL_VALUE}
              onValueChange={(value) => setProductId(value === ALL_VALUE ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All products</SelectItem>
                {products.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Variant</label>
            <Select
              value={variantId || ALL_VALUE}
              onValueChange={(value) => setVariantId(value === ALL_VALUE ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All variants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All variants</SelectItem>
                {variants.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {!loading && rows.length === 0 && !errorMessage ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No inventory balances found.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchKey="product"
          searchPlaceholder="Search by product…"
          emptyMessage={loading ? "Loading inventory balances…" : "No inventory balances found."}
        />
      )}
    </div>
  )
}
