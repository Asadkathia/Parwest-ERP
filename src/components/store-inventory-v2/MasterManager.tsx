"use client"

/**
 * Parwest ERP — MasterManager (Phase 6B reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * Single-file reskin of the catch-all master taxonomy editor (stores,
 * vendors, categories, brands, units, statuses, conditions, weapon-types,
 * calibres, license-types, variations, repairings).
 *
 * Reskin only — same payload, same `useScopeQuery()` server-side scoping,
 * same legacy validations (mirrored in `@/lib/schemas/inventory-master`).
 *
 * Notable parity decisions:
 *   - The inline `RegionUrlPicker` is REMOVED. URL params (`?regionId=…`)
 *     are still honored via `useScopeQuery()` and the global topbar feeds
 *     them in. Mirrors AdjustmentsManager / AuditManager (Phase 6A/6B).
 *   - Delete is wired through a shadcn `AlertDialog` destructive variant.
 *   - Permission gates: CREATE/UPDATE wrap the form; DELETE wraps the row
 *     action.
 *   - All data.error reads in legacy upstream shape remain handled by the
 *     shared `apiSend`/`apiGet` envelope helpers — no `data.error` paths
 *     in this file.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { DataTable } from "@/components/shadcn/data-table"
import { Card, CardContent } from "@/components/shadcn/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import { Checkbox } from "@/components/shadcn/checkbox"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/shadcn/alert-dialog"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"
import { useScopeQuery } from "@/components/store-inventory-v2/use-scope-query"
import {
  inventoryMasterFormSchema,
  validateInventoryMasterVariant,
  type InventoryMasterCategoryAssignee,
  type InventoryMasterFormInput,
  type InventoryMasterStoreType,
  type InventoryMasterVariant,
} from "@/lib/schemas/inventory-master"

type RegionOption = { id: string; name: string }

type MasterResource =
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

type RegionalOffice = { id: string; name: string }
type Option = { id: string; name: string }

type Row = {
  id: string
  name: string
  contact?: string | null
  companyPhone?: string | null
  contactPerson?: string | null
  contactPersonPhone?: string | null
  code?: string | null
  shortCode?: string | null
  description?: string | null
  type?: string | null
  contactNumber?: string | null
  address?: string | null
  isActive?: boolean
  regionalOfficeId?: string | null
  regionalOffice?: { id: string; name: string } | null
  prefix?: string | null
  isHeadOffice?: boolean
  latitude?: number | null
  longitude?: number | null
  parentId?: string | null
  parent?: { id: string; name: string } | null
  canAssignGuard?: boolean
  canAssignEmployee?: boolean
  canAssignClient?: boolean
  categoryId?: string | null
  category?: { id: string; name: string } | null
}

type Props = {
  resource: MasterResource
  title: string
  subtitle: string
  supportsDescription?: boolean
  supportsStoreFields?: boolean
  supportsUnitShortCode?: boolean
  supportsContact?: boolean
  supportsCategoryFields?: boolean
  supportsVendorFields?: boolean
  supportsStatusCategory?: boolean
  /** Legacy region picker props — kept for prop-shape compat only. */
  regions?: RegionOption[]
  locked?: boolean
}

const ASSIGNEE_OPTIONS: Array<{
  value: InventoryMasterCategoryAssignee
  label: string
}> = [
  { value: "GUARD", label: "Guard" },
  { value: "EMPLOYEE", label: "Employee" },
  { value: "CLIENT", label: "Client" },
]

const ASSIGNEE_LABELS: Record<InventoryMasterCategoryAssignee, string> = {
  GUARD: "Guard",
  EMPLOYEE: "Employee",
  CLIENT: "Client",
}

const NONE_VALUE = "__none__"

function buildEmptyForm(
  lockedOfficeId: string | null,
): InventoryMasterFormInput {
  return {
    name: "",
    code: "",
    shortCode: "",
    description: "",
    contact: "",
    companyPhone: "",
    contactPerson: "",
    contactPersonPhone: "",
    type: "STORE",
    contactNumber: "",
    address: "",
    regionalOfficeId: lockedOfficeId ?? "",
    prefix: "",
    isHeadOffice: false,
    latitude: "",
    longitude: "",
    parentId: "",
    assignee: [],
    categoryId: "",
  }
}

function resolveCategoryAssignees(row: {
  canAssignGuard?: boolean
  canAssignEmployee?: boolean
  canAssignClient?: boolean
}): InventoryMasterCategoryAssignee[] {
  return [
    row.canAssignGuard ? "GUARD" : null,
    row.canAssignEmployee ? "EMPLOYEE" : null,
    row.canAssignClient ? "CLIENT" : null,
  ].filter(Boolean) as InventoryMasterCategoryAssignee[]
}

function formatCategoryAssignees(row: {
  canAssignGuard?: boolean
  canAssignEmployee?: boolean
  canAssignClient?: boolean
}): string {
  const active = resolveCategoryAssignees(row)
  if (active.length === 0) return "—"
  return active.map((value) => ASSIGNEE_LABELS[value]).join(", ")
}

export default function MasterManager({
  resource,
  title,
  subtitle,
  supportsDescription = false,
  supportsStoreFields = false,
  supportsUnitShortCode = false,
  supportsContact = false,
  supportsCategoryFields = false,
  supportsVendorFields = false,
  supportsStatusCategory = false,
  regions: _regions = [],
  locked: _locked = false,
}: Props) {
  // Phase 6B: region picker handled by global topbar; props kept for compat.
  void _regions
  void _locked

  const isVendorResource = resource === "vendors"
  const scopeQuery = useScopeQuery()
  const { data: session } = useSession()
  const sessionUser = session?.user as
    | {
        roleScopeType?: "GLOBAL" | "REGIONAL"
        regionId?: string | null
        regionalOfficeId?: string | null
      }
    | undefined
  const isRegional = sessionUser?.roleScopeType === "REGIONAL"
  const callerRegionId = isRegional ? sessionUser?.regionId ?? null : null
  const callerRegionalOfficeId = isRegional
    ? sessionUser?.regionalOfficeId ?? null
    : null

  // Stores belong to a regional office. When a REGIONAL user with a single
  // assigned office creates a store, hardcode that office instead of letting
  // them pick an arbitrary one (which would also be rejected by the server).
  const lockedOfficeId = supportsStoreFields ? callerRegionalOfficeId : null

  const variant: InventoryMasterVariant = useMemo(
    () => ({
      supportsDescription,
      supportsStoreFields,
      supportsUnitShortCode,
      supportsContact,
      supportsCategoryFields,
      supportsVendorFields,
      supportsStatusCategory,
    }),
    [
      supportsDescription,
      supportsStoreFields,
      supportsUnitShortCode,
      supportsContact,
      supportsCategoryFields,
      supportsVendorFields,
      supportsStatusCategory,
    ],
  )

  const [rows, setRows] = useState<Row[]>([])
  const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const form = useForm<InventoryMasterFormInput>({
    resolver: zodResolver(inventoryMasterFormSchema),
    defaultValues: buildEmptyForm(lockedOfficeId),
    mode: "onSubmit",
  })

  const resetForm = useCallback(() => {
    form.reset(buildEmptyForm(lockedOfficeId))
    setEditingId(null)
  }, [form, lockedOfficeId])

  const loadRows = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    try {
      const effectiveRegionId = scopeQuery.regionId || callerRegionId
      const officesUrl = effectiveRegionId
        ? `/api/regional-offices?regionId=${encodeURIComponent(effectiveRegionId)}`
        : "/api/regional-offices"
      // Region/office filter only applies to scoped resources (currently
      // 'stores'). Other masters (brands, units, categories, …) are global
      // taxonomies.
      const masterUrl =
        resource === "stores"
          ? `/api/store-inventory/v2/masters/${resource}${scopeQuery.query}`
          : `/api/store-inventory/v2/masters/${resource}`
      const [masterRows, officeRows, categoryRows] = await Promise.all([
        apiGet<Row[]>(masterUrl),
        supportsStoreFields
          ? apiGet<RegionalOffice[]>(officesUrl)
          : Promise.resolve([] as RegionalOffice[]),
        supportsStatusCategory
          ? apiGet<Option[]>("/api/store-inventory/v2/masters/categories")
          : Promise.resolve([] as Option[]),
      ])

      setRows(masterRows)
      setRegionalOffices(officeRows)
      setCategories(categoryRows)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Failed to load ${title}.`
      setErrorMessage(message)
      setRows([])
      setRegionalOffices([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [
    resource,
    supportsStatusCategory,
    supportsStoreFields,
    title,
    callerRegionId,
    scopeQuery.query,
    scopeQuery.regionId,
  ])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const startEdit = (row: Row) => {
    setEditingId(row.id)
    form.reset({
      name: row.name || "",
      code: row.code || "",
      shortCode: row.shortCode || "",
      description: row.description || "",
      contact: row.contact || "",
      companyPhone: row.companyPhone || "",
      contactPerson: row.contactPerson || "",
      contactPersonPhone: row.contactPersonPhone || "",
      type: row.type === "WAREHOUSE" ? "WAREHOUSE" : "STORE",
      contactNumber: row.contactNumber || "",
      address: row.address || "",
      regionalOfficeId: row.regionalOfficeId || "",
      prefix: row.prefix || "",
      isHeadOffice: row.isHeadOffice || false,
      latitude: row.latitude != null ? String(row.latitude) : "",
      longitude: row.longitude != null ? String(row.longitude) : "",
      parentId: row.parentId || "",
      assignee: resolveCategoryAssignees(row),
      categoryId: row.categoryId || "",
    })
  }

  const onSubmit = async (values: InventoryMasterFormInput) => {
    // Variant-specific required-field gates (mirrors legacy validations).
    const variantErrors = validateInventoryMasterVariant(values, variant)
    if (variantErrors.length > 0) {
      for (const err of variantErrors) {
        form.setError(err.field, { message: err.message })
      }
      return
    }

    const payload: Record<string, unknown> = {
      name: values.name.trim(),
    }

    if (supportsDescription) {
      payload.description = values.description?.trim() || null
    }
    if (supportsContact) {
      payload.contact = values.contact?.trim() || null
    }
    if (supportsVendorFields) {
      payload.companyPhone = values.companyPhone?.trim() || null
      payload.contactPerson = values.contactPerson?.trim() || null
      payload.contactPersonPhone = values.contactPersonPhone?.trim() || null
      payload.address = values.address?.trim() || null
    }
    if (supportsUnitShortCode) {
      payload.shortCode = values.shortCode?.trim() || ""
    }

    if (supportsStoreFields) {
      const normalizedType: InventoryMasterStoreType =
        values.type === "WAREHOUSE" ? "WAREHOUSE" : "STORE"
      payload.type = normalizedType
      payload.prefix = values.prefix?.trim() || null
      payload.isHeadOffice = values.isHeadOffice
      payload.latitude = values.latitude?.trim()
        ? Number(values.latitude)
        : null
      payload.longitude = values.longitude?.trim()
        ? Number(values.longitude)
        : null
      payload.contactNumber = values.contactNumber?.trim() || null
      payload.address = values.address?.trim() || null
      payload.regionalOfficeId = values.regionalOfficeId || null
      payload.isActive = true
    }

    if (supportsCategoryFields) {
      payload.parentId = values.parentId || null
      payload.canAssignGuard = values.assignee.includes("GUARD")
      payload.canAssignEmployee = values.assignee.includes("EMPLOYEE")
      payload.canAssignClient = values.assignee.includes("CLIENT")
    }

    if (supportsStatusCategory) {
      payload.categoryId = values.categoryId || null
    }

    try {
      if (editingId) {
        await apiSend(
          `/api/store-inventory/v2/masters/${resource}/${editingId}`,
          "PATCH",
          payload,
        )
        toast.success(`${title} updated successfully.`)
      } else {
        await apiSend(
          `/api/store-inventory/v2/masters/${resource}`,
          "POST",
          payload,
        )
        toast.success(`${title} created successfully.`)
      }
      resetForm()
      await loadRows()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Failed to save ${title}.`
      toast.error(message)
    }
  }

  const confirmRemove = async () => {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    try {
      await apiSend(
        `/api/store-inventory/v2/masters/${resource}/${id}`,
        "DELETE",
      )
      toast.success(`${title} deleted successfully.`)
      if (editingId === id) resetForm()
      await loadRows()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Failed to delete ${title}.`
      toast.error(message)
    }
  }

  // ─── List columns ────────────────────────────────────────────────────────
  const columns: ColumnDef<Row>[] = useMemo(() => {
    const cols: ColumnDef<Row>[] = [
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
    ]

    if (supportsStoreFields) {
      cols.push(
        {
          id: "code",
          header: "Code",
          accessorFn: (row) => row.code || "—",
          cell: ({ row }) => (
            <span className="tabular-nums">{row.original.code || "—"}</span>
          ),
        },
        {
          id: "type",
          header: "Type",
          accessorFn: (row) => row.type || "—",
          cell: ({ row }) => {
            const type = row.original.type
            if (!type) return <span>—</span>
            const variantLabel: "default" | "secondary" =
              type === "WAREHOUSE" ? "secondary" : "default"
            return <Badge variant={variantLabel}>{type}</Badge>
          },
        },
        {
          id: "regionalOffice",
          header: "Regional Office",
          accessorFn: (row) => row.regionalOffice?.name || "—",
        },
        {
          id: "prefix",
          header: "Prefix",
          accessorFn: (row) => row.prefix || "—",
        },
        {
          id: "isHeadOffice",
          header: "H.O",
          accessorFn: (row) => (row.isHeadOffice ? "Yes" : "No"),
          cell: ({ row }) => (
            <Badge
              variant={row.original.isHeadOffice ? "default" : "secondary"}
            >
              {row.original.isHeadOffice ? "Yes" : "No"}
            </Badge>
          ),
        },
      )
    }

    if (supportsCategoryFields) {
      cols.push(
        {
          id: "parent",
          header: "Parent",
          accessorFn: (row) => row.parent?.name || "—",
        },
        {
          id: "assignees",
          header: "Assignees",
          accessorFn: (row) => formatCategoryAssignees(row),
          cell: ({ row }) => formatCategoryAssignees(row.original),
        },
      )
    }

    if (supportsUnitShortCode) {
      cols.push({
        id: "shortCode",
        header: "Short Code",
        accessorFn: (row) => row.shortCode || "—",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.shortCode || "—"}
          </span>
        ),
      })
    }

    if (supportsContact) {
      cols.push({
        id: "contact",
        header: "Contact",
        accessorFn: (row) => row.contact || "—",
      })
    }

    if (supportsVendorFields) {
      cols.push(
        {
          id: "companyPhone",
          header: "Company Phone",
          accessorFn: (row) => row.companyPhone || "—",
          cell: ({ row }) => (
            <span className="tabular-nums">
              {row.original.companyPhone || "—"}
            </span>
          ),
        },
        {
          id: "contactPerson",
          header: "Contact Person Name",
          accessorFn: (row) => row.contactPerson || "—",
        },
        {
          id: "contactPersonPhone",
          header: "Contact Person Phone",
          accessorFn: (row) => row.contactPersonPhone || "—",
          cell: ({ row }) => (
            <span className="tabular-nums">
              {row.original.contactPersonPhone || "—"}
            </span>
          ),
        },
        {
          id: "address",
          header: "Address",
          accessorFn: (row) => row.address || "—",
        },
      )
    }

    if (supportsStatusCategory) {
      cols.push({
        id: "category",
        header: "Category",
        accessorFn: (row) => row.category?.name || "—",
      })
    }

    if (supportsDescription) {
      cols.push({
        id: "description",
        header: "Description",
        accessorFn: (row) => row.description || "—",
      })
    }

    cols.push({
      id: "actions",
      header: () => <span className="block text-end">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PermissionGate module="INVENTORY" action="UPDATE" mode="hide">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => startEdit(row.original)}
            >
              <Pencil className="me-1 h-3.5 w-3.5" />
              Edit
            </Button>
          </PermissionGate>
          <PermissionGate module="INVENTORY" action="DELETE" mode="hide">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setPendingDeleteId(row.original.id)}
            >
              <Trash2 className="me-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </PermissionGate>
        </div>
      ),
    })

    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    supportsStoreFields,
    supportsCategoryFields,
    supportsUnitShortCode,
    supportsContact,
    supportsVendorFields,
    supportsStatusCategory,
    supportsDescription,
  ])

  const watchedType = form.watch("type")
  const watchedAssignees = form.watch("assignee")
  const watchedIsHeadOffice = form.watch("isHeadOffice")
  const editingCode = form.watch("code")

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

      {/* ── Create / edit form ──────────────────────────────────────────── */}
      <PermissionGate
        module="INVENTORY"
        action={editingId ? "UPDATE" : "CREATE"}
        mode="hide"
      >
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div
                  className={`grid grid-cols-1 gap-4 ${
                    supportsStoreFields ? "md:grid-cols-3" : "md:grid-cols-2"
                  }`}
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {isVendorResource ? "Company Name *" : "Name *"}
                        </FormLabel>
                        <FormControl>
                          <Input
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

                  {supportsUnitShortCode ? (
                    <FormField
                      control={form.control}
                      name="shortCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Short Code *</FormLabel>
                          <FormControl>
                            <Input
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
                  ) : null}

                  {supportsDescription ? (
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input
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
                  ) : null}

                  {supportsContact ? (
                    <FormField
                      control={form.control}
                      name="contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact</FormLabel>
                          <FormControl>
                            <Input
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
                  ) : null}

                  {supportsVendorFields ? (
                    <>
                      <FormField
                        control={form.control}
                        name="companyPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Phone *</FormLabel>
                            <FormControl>
                              <Input
                                className="tabular-nums"
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
                      <FormField
                        control={form.control}
                        name="contactPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Person Name *</FormLabel>
                            <FormControl>
                              <Input
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
                      <FormField
                        control={form.control}
                        name="contactPersonPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Person Phone *</FormLabel>
                            <FormControl>
                              <Input
                                className="tabular-nums"
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
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Address *</FormLabel>
                            <FormControl>
                              <Input
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
                    </>
                  ) : null}

                  {supportsStoreFields ? (
                    <>
                      <div>
                        <Label>Code (Auto-generated)</Label>
                        <Input
                          readOnly
                          value={editingId ? editingCode || "" : ""}
                          placeholder={
                            editingId
                              ? ""
                              : "Generated on create from region + type"
                          }
                          className="tabular-nums"
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="type"
                        render={() => (
                          <FormItem>
                            <FormLabel>Type *</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant={
                                    watchedType === "STORE"
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    form.setValue("type", "STORE", {
                                      shouldDirty: true,
                                    })
                                  }
                                >
                                  Store
                                </Button>
                                <Button
                                  type="button"
                                  variant={
                                    watchedType === "WAREHOUSE"
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    form.setValue("type", "WAREHOUSE", {
                                      shouldDirty: true,
                                    })
                                  }
                                >
                                  Warehouse
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {lockedOfficeId ? null : (
                        <FormField
                          control={form.control}
                          name="regionalOfficeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Regional Office</FormLabel>
                              <Select
                                value={field.value || NONE_VALUE}
                                onValueChange={(value) =>
                                  field.onChange(
                                    value === NONE_VALUE ? "" : value,
                                  )
                                }
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select office" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value={NONE_VALUE}>
                                    Select office
                                  </SelectItem>
                                  {regionalOffices.map((office) => (
                                    <SelectItem
                                      key={office.id}
                                      value={office.id}
                                    >
                                      {office.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="contactNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Number</FormLabel>
                            <FormControl>
                              <Input
                                className="tabular-nums"
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

                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Input
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

                      <FormField
                        control={form.control}
                        name="prefix"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prefix</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. WH-KHI"
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

                      <FormField
                        control={form.control}
                        name="isHeadOffice"
                        render={() => (
                          <FormItem className="flex flex-row items-center gap-2 pt-6">
                            <FormControl>
                              <Checkbox
                                id="isHeadOffice"
                                checked={watchedIsHeadOffice}
                                onCheckedChange={(value) =>
                                  form.setValue("isHeadOffice", value === true, {
                                    shouldDirty: true,
                                  })
                                }
                              />
                            </FormControl>
                            <FormLabel
                              htmlFor="isHeadOffice"
                              className="text-sm font-normal text-muted-foreground"
                            >
                              Is Head Office
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="latitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Latitude</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                className="tabular-nums"
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

                      <FormField
                        control={form.control}
                        name="longitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Longitude</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                className="tabular-nums"
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
                    </>
                  ) : null}

                  {supportsCategoryFields ? (
                    <FormField
                      control={form.control}
                      name="parentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parent Category</FormLabel>
                          <Select
                            value={field.value || NONE_VALUE}
                            onValueChange={(value) =>
                              field.onChange(
                                value === NONE_VALUE ? "" : value,
                              )
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="None (Top Level)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NONE_VALUE}>
                                None (Top Level)
                              </SelectItem>
                              {rows
                                .filter((r) => r.id !== editingId)
                                .map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}

                  {supportsCategoryFields ? (
                    <div>
                      <Label>Assignees</Label>
                      <div className="flex flex-wrap gap-4 rounded-md border p-3">
                        {ASSIGNEE_OPTIONS.map((option) => {
                          const checked = watchedAssignees.includes(
                            option.value,
                          )
                          return (
                            <label
                              key={option.value}
                              className="inline-flex items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  const isOn = value === true
                                  const next = isOn
                                    ? [
                                        ...watchedAssignees.filter(
                                          (entry) => entry !== option.value,
                                        ),
                                        option.value,
                                      ]
                                    : watchedAssignees.filter(
                                        (entry) => entry !== option.value,
                                      )
                                  form.setValue("assignee", next, {
                                    shouldDirty: true,
                                  })
                                }}
                              />
                              {option.label}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {supportsStatusCategory ? (
                    <FormField
                      control={form.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select
                            value={field.value || NONE_VALUE}
                            onValueChange={(value) =>
                              field.onChange(
                                value === NONE_VALUE ? "" : value,
                              )
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NONE_VALUE}>None</SelectItem>
                              {categories.map((category) => (
                                <SelectItem
                                  key={category.id}
                                  value={category.id}
                                >
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting
                      ? "Saving..."
                      : editingId
                        ? "Update"
                        : "Create"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetForm}
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
      {!loading && rows.length === 0 && !errorMessage ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No {title.toLowerCase()} found.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchKey="name"
          searchPlaceholder={`Search ${title.toLowerCase()} by name…`}
          emptyMessage={
            loading
              ? `Loading ${title.toLowerCase()}…`
              : `No ${title.toLowerCase()} found.`
          }
        />
      )}

      {/* ── Delete confirm dialog ───────────────────────────────────────── */}
      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
      >
        <AlertDialogTrigger asChild>
          <span className="hidden" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The record will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void confirmRemove()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
