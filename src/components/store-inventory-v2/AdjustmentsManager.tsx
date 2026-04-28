"use client"

/**
 * Parwest ERP — AdjustmentsManager (Phase 6B reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * Migrates the smallest of the 5 mixed list+form managers in store-inventory.
 * Reskin only — same payload, same `useScopeQuery()` server-side scoping,
 * same legacy validations (mirrored in
 * `@/lib/schemas/inventory-adjustment`).
 *
 * Notable parity decisions:
 *   - The RegionUrlPicker is REMOVED. URL params (`?regionId=…`) are still
 *     honored via `useScopeQuery()` and the global topbar feeds them in.
 *     This mirrors the Phase 6A pattern in AuditManager / InventoriesManager.
 *   - There are no approve/cancel/delete actions on adjustments — they're
 *     append-only with stock movements emitted in the same transaction. So
 *     no AlertDialog destructive variants are wired here.
 *   - No `isWorkflowRuleEnabled('inventory.adjustments.*')` flags exist for
 *     this entity. (Behavior audit confirmed.)
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertCircle, Plus, Trash2 } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { DataTable } from "@/components/shadcn/data-table"
import { Card, CardContent } from "@/components/shadcn/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Textarea } from "@/components/shadcn/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/form"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"
import { useScopeQuery } from "@/components/store-inventory-v2/use-scope-query"
import {
  inventoryAdjustmentCreateSchema,
  type InventoryAdjustmentCreateInput,
} from "@/lib/schemas/inventory-adjustment"

type Option = { id: string; name: string }
type RegionOption = { id: string; name: string }
type ProductScope = "NON_WEAPON" | "WEAPON_AMMO"

type Product = {
  id: string
  sku: string
  name: string
  category?: { id: string; name: string } | null
  calibre?: { id: string; name: string } | null
  weaponType?: { id: string; name: string } | null
  variation?: { id: string; name: string } | null
}

type InventoryBalance = {
  id: string
  storeId: string
  productId: string
  quantityOnHand: number
  quantityHeld: number
}

type Condition = { id: string; name: string }

type Adjustment = {
  id: string
  adjustmentType: "INCREASE" | "DECREASE" | "SET"
  reason?: string | null
  notes?: string | null
  adjustedAt: string
  store: { id: string; name: string }
  createdBy: { id: string; name: string }
  lines: Array<{
    id: string
    product: Product
    quantityBefore: number
    quantityDelta: number
    quantityAfter: number
  }>
}

const ALL_VALUE = "__all__"
const NEW_CONDITION_VALUE = "__new__"

const DEFAULT_FORM: InventoryAdjustmentCreateInput = {
  storeId: "",
  notes: "",
  lines: [
    {
      productId: "",
      quantity: 1,
      conditionId: "",
      action: "INCREASE",
    },
  ],
  categoryScope: "NON_WEAPON",
}

export default function AdjustmentsManager({
  createMode = false,
  productScope = "NON_WEAPON",
  regions: _regions = [],
  locked: _locked = false,
}: {
  createMode?: boolean
  productScope?: ProductScope
  regions?: RegionOption[]
  locked?: boolean
}) {
  // Phase 6B: region picker handled by global topbar; props kept for compat.
  void _regions
  void _locked

  // Server-side scoping preserved verbatim — DO NOT touch.
  const scopeQuery = useScopeQuery()

  const [rows, setRows] = useState<Adjustment[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [conditions, setConditions] = useState<Condition[]>([])
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>(ALL_VALUE)
  const [storeFilter, setStoreFilter] = useState<string>(ALL_VALUE)

  const form = useForm<InventoryAdjustmentCreateInput>({
    resolver: zodResolver(inventoryAdjustmentCreateSchema),
    defaultValues: { ...DEFAULT_FORM, categoryScope: productScope },
    mode: "onSubmit",
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  })

  // Keep categoryScope in sync with the screen route prop.
  useEffect(() => {
    form.setValue("categoryScope", productScope)
  }, [form, productScope])

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const [adjustmentRows, storeRows, productRows, conditionRows, inventoryRows] =
        await Promise.all([
          apiGet<Adjustment[]>(
            `/api/store-inventory/v2/adjustments?categoryScope=${productScope}${scopeQuery.suffix}`,
          ),
          apiGet<Option[]>(`/api/store-inventory/v2/masters/stores${scopeQuery.query}`),
          apiGet<Product[]>("/api/store-inventory/v2/products"),
          apiGet<Condition[]>("/api/store-inventory/v2/masters/conditions"),
          apiGet<
            Array<
              InventoryBalance & {
                store: { id: string }
                product: { id: string }
              }
            >
          >(
            `/api/store-inventory/v2/inventories?includeZero=true&categoryScope=${
              productScope === "WEAPON_AMMO" ? "WEAPON" : "NON_WEAPON"
            }${scopeQuery.suffix}`,
          ),
        ])

      setRows(adjustmentRows)
      setStores(storeRows)
      setConditions(conditionRows)
      setProducts(
        productRows.filter((product) => {
          const category = String(product.category?.name ?? "").toLowerCase()
          const isWeaponOrAmmo =
            category.includes("weapon") || category.includes("ammo")
          return productScope === "WEAPON_AMMO" ? isWeaponOrAmmo : !isWeaponOrAmmo
        }),
      )
      setBalances(
        inventoryRows.map((row) => ({
          id: row.id,
          storeId: row.store?.id || row.storeId || "",
          productId: row.product?.id || row.productId || "",
          quantityOnHand: row.quantityOnHand,
          quantityHeld: row.quantityHeld,
        })),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load adjustments."
      setErrorMessage(message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [productScope, scopeQuery.suffix, scopeQuery.query])

  useEffect(() => {
    void load()
  }, [load])

  const stockFor = useCallback(
    (storeId: string, productId: string) => {
      if (!storeId || !productId) return { available: 0, reusable: 0 }
      const row = balances.find(
        (entry) => entry.storeId === storeId && entry.productId === productId,
      )
      return {
        available: row?.quantityOnHand ?? 0,
        reusable: row?.quantityHeld ?? 0,
      }
    },
    [balances],
  )

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (typeFilter !== ALL_VALUE && row.adjustmentType !== typeFilter) return false
      if (storeFilter !== ALL_VALUE && row.store.id !== storeFilter) return false
      return true
    })
  }, [rows, typeFilter, storeFilter])

  const onSubmit = async (values: InventoryAdjustmentCreateInput) => {
    // Data-dependent guard: DECREASE quantity must not exceed available stock.
    // (Cannot live in the zod schema since it depends on the loaded balances.)
    const invalidDecrease = values.lines.find((line) => {
      if (line.action !== "DECREASE") return false
      const stock = stockFor(values.storeId, line.productId)
      return line.quantity > stock.available
    })
    if (invalidDecrease) {
      const product = products.find((item) => item.id === invalidDecrease.productId)
      const message = `${product?.name || "Selected product"} exceeds available stock.`
      form.setError("lines", { message })
      toast.error(message)
      return
    }

    const payload = {
      storeId: values.storeId,
      adjustmentType: "INCREASE" as const,
      categoryScope: values.categoryScope,
      notes: values.notes?.trim() || null,
      lines: values.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        conditionId: line.conditionId || null,
        adjustmentType: line.action,
        notes: line.conditionId ? `condition:${line.conditionId}` : null,
      })),
    }

    try {
      await apiSend<Adjustment>("/api/store-inventory/v2/adjustments", "POST", payload)
      toast.success("Adjustment applied successfully.")
      form.reset({ ...DEFAULT_FORM, categoryScope: productScope })
      await load()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create adjustment."
      toast.error(message)
    }
  }

  const watchedLines = form.watch("lines")
  const watchedStoreId = form.watch("storeId")
  const lineTotal = useMemo(
    () =>
      watchedLines.reduce(
        (sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0),
        0,
      ),
    [watchedLines],
  )

  const title = createMode
    ? productScope === "WEAPON_AMMO"
      ? "Add Weapon Adjustment"
      : "Add Regular Adjustment"
    : productScope === "WEAPON_AMMO"
      ? "Weapon Adjustments"
      : "Adjustments"
  const subtitle = createMode
    ? "Staging-style wizard for stock increase/decrease by product line."
    : "Review historical stock adjustments."

  // ─── List columns ────────────────────────────────────────────────────────
  const columns: ColumnDef<Adjustment>[] = [
    {
      id: "store",
      header: "Store",
      accessorFn: (row) => row.store.name,
      cell: ({ row }) => <span className="font-medium">{row.original.store.name}</span>,
    },
    {
      id: "adjustmentType",
      accessorKey: "adjustmentType",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.adjustmentType
        const variant: "default" | "secondary" | "destructive" =
          type === "INCREASE" ? "default" : type === "DECREASE" ? "destructive" : "secondary"
        return <Badge variant={variant}>{type}</Badge>
      },
    },
    {
      id: "lineCount",
      header: () => <span className="block text-end">Lines</span>,
      accessorFn: (row) => row.lines.length,
      cell: ({ row }) => (
        <span className="block text-end tabular-nums">{row.original.lines.length}</span>
      ),
    },
    {
      id: "delta",
      header: () => <span className="block text-end">Total Delta</span>,
      accessorFn: (row) =>
        row.lines.reduce((sum, line) => sum + line.quantityDelta, 0),
      cell: ({ row }) => {
        const delta = row.original.lines.reduce(
          (sum, line) => sum + line.quantityDelta,
          0,
        )
        return (
          <span
            className={`block text-end tabular-nums ${
              delta > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : delta < 0
                  ? "text-destructive"
                  : ""
            }`}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )
      },
    },
    {
      id: "reason",
      header: "Reason",
      accessorFn: (row) => row.reason || "—",
    },
    {
      id: "createdBy",
      header: "By",
      accessorFn: (row) => row.createdBy?.name || "—",
    },
    {
      id: "adjustedAt",
      accessorKey: "adjustedAt",
      header: "Date",
      cell: ({ row }) => new Date(row.original.adjustedAt).toLocaleDateString("en-US"),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {/* ── Create form ─────────────────────────────────────────────────── */}
      <PermissionGate module="INVENTORY" action="CREATE" mode="hide">
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="storeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Store *</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select store" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stores.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Products Table *
                  </div>
                  {fields.map((field, index) => {
                    const lineValue = watchedLines[index]
                    const selectedProduct =
                      products.find((row) => row.id === lineValue?.productId) || null
                    const stock = stockFor(
                      watchedStoreId,
                      lineValue?.productId || "",
                    )
                    return (
                      <div
                        key={field.id}
                        className="grid grid-cols-1 gap-3 border-b pb-4 md:grid-cols-12"
                      >
                        <div className="md:col-span-3">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.productId`}
                            render={({ field: productField }) => (
                              <FormItem>
                                <FormLabel className="text-xs">
                                  Select Product
                                </FormLabel>
                                <Select
                                  value={productField.value || ""}
                                  onValueChange={productField.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Type product code and select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {products.map((product) => (
                                      <SelectItem
                                        key={product.id}
                                        value={product.id}
                                      >
                                        {product.sku} - {product.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <ReadOnlyCell
                          className="md:col-span-2"
                          label="Product Code"
                          value={selectedProduct?.sku || "—"}
                        />
                        <ReadOnlyCell
                          className="md:col-span-1"
                          label="Calibre"
                          value={selectedProduct?.calibre?.name || "—"}
                        />
                        <ReadOnlyCell
                          className="md:col-span-1"
                          label="Weapon Type"
                          value={selectedProduct?.weaponType?.name || "—"}
                        />
                        <ReadOnlyCell
                          className="md:col-span-1"
                          label="Variant"
                          value={selectedProduct?.variation?.name || "—"}
                        />
                        <ReadOnlyCell
                          className="md:col-span-1"
                          label="New Stock"
                          value={String(stock.available)}
                          numeric
                        />
                        <ReadOnlyCell
                          className="md:col-span-1"
                          label="Reusable"
                          value={String(stock.reusable)}
                          numeric
                        />
                        <div className="md:col-span-1">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.quantity`}
                            render={({ field: qtyField }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Quantity</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    className="tabular-nums"
                                    value={
                                      Number.isFinite(qtyField.value)
                                        ? qtyField.value
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const next = e.target.value
                                      qtyField.onChange(
                                        next === "" ? Number.NaN : Number(next),
                                      )
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-1">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.conditionId`}
                            render={({ field: condField }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Condition</FormLabel>
                                <Select
                                  value={condField.value || NEW_CONDITION_VALUE}
                                  onValueChange={(value) =>
                                    condField.onChange(
                                      value === NEW_CONDITION_VALUE ? "" : value,
                                    )
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value={NEW_CONDITION_VALUE}>
                                      New
                                    </SelectItem>
                                    {conditions.map((condition) => (
                                      <SelectItem
                                        key={condition.id}
                                        value={condition.id}
                                      >
                                        {condition.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-1">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.action`}
                            render={({ field: actionField }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Action</FormLabel>
                                <Select
                                  value={actionField.value}
                                  onValueChange={actionField.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="INCREASE">Addition</SelectItem>
                                    <SelectItem value="DECREASE">
                                      Subtraction
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-1 flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            disabled={fields.length === 1}
                            onClick={() => remove(index)}
                            aria-label="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}

                  {form.formState.errors.lines?.message ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {form.formState.errors.lines.message}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        append({
                          productId: "",
                          quantity: 1,
                          conditionId: "",
                          action: "INCREASE",
                        })
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Product
                    </Button>
                    <div className="rounded border px-3 py-1.5 text-sm font-medium text-muted-foreground tabular-nums">
                      Total Qty {lineTotal}
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? "Saving..." : "Apply Adjustment"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      form.reset({ ...DEFAULT_FORM, categoryScope: productScope })
                    }
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </PermissionGate>

      {/* ── List ────────────────────────────────────────────────────────── */}
      {!createMode ? (
        <>
          <Card>
            <CardContent className="grid grid-cols-1 gap-3 pt-6 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Store
                </label>
                <Select value={storeFilter} onValueChange={setStoreFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All stores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All stores</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Type
                </label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All types</SelectItem>
                    <SelectItem value="INCREASE">Increase</SelectItem>
                    <SelectItem value="DECREASE">Decrease</SelectItem>
                    <SelectItem value="SET">Set</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStoreFilter(ALL_VALUE)
                    setTypeFilter(ALL_VALUE)
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {!loading && visibleRows.length === 0 && !errorMessage ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No adjustments found.
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={visibleRows}
              searchKey="store"
              searchPlaceholder="Search by store…"
              emptyMessage={
                loading ? "Loading adjustments…" : "No adjustments found."
              }
            />
          )}
        </>
      ) : null}
    </div>
  )
}

function ReadOnlyCell({
  label,
  value,
  className,
  numeric = false,
}: {
  label: string
  value: string
  className?: string
  numeric?: boolean
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        readOnly
        value={value}
        className={numeric ? "tabular-nums text-end" : ""}
      />
    </div>
  )
}
