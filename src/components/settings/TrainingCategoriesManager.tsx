"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/shadcn/card"
import { Button } from "@/components/shadcn/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog"
import DataTable from "@/components/shared/DataTable"

type CategoryRow = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export default function TrainingCategoriesManager() {
  const [rows, setRows] = useState<CategoryRow[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [sortOrder, setSortOrder] = useState<string>("")
  const [isActive, setIsActive] = useState(true)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/training-categories?includeInactive=true", { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.message || "Failed to load training categories.")
      const list: CategoryRow[] = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
      setRows(list)
    } catch (error: unknown) {
      setRows([])
      toast.error(getErrorMessage(error, "Failed to load training categories."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reset = () => {
    setEditingId(null)
    setName("")
    setDescription("")
    setSortOrder("")
    setIsActive(true)
  }

  const save = async () => {
    if (!name.trim()) {
      toast.error("Category name is required.")
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        isActive,
      }
      if (sortOrder !== "" && !Number.isNaN(Number(sortOrder))) body.sortOrder = Number(sortOrder)

      const response = await fetch(
        editingId ? `/api/training-categories/${editingId}` : "/api/training-categories",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          payload?.message || (editingId ? "Failed to update category." : "Failed to create category.")
        )
      }
      toast.success(editingId ? "Training category updated" : "Training category created")
      reset()
      await load()
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(error, editingId ? "Failed to update category." : "Failed to create category.")
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      const response = await fetch(`/api/training-categories/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to deactivate category.")
      toast.success("Training category deactivated")
      if (editingId === id) reset()
      await load()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to deactivate category."))
    } finally {
      setConfirmDelete(null)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) => row.name.toLowerCase().includes(q) || (row.description ?? "").toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Settings: Training Categories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin-managed list of OJT training items (e.g. Basic Drill, Firearms Handling). Used to render Training Checks on the OnJob Trainings tab.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Name *</label>
              <input className="ui-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basic Drill" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
              <input className="ui-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Sort Order</label>
              <input className="ui-input" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Active</label>
              <label className="inline-flex items-center gap-2 mt-2">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
                <span className="text-sm">Active</span>
              </label>
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
              <input className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
            <Button variant="secondary" onClick={reset}>Reset</Button>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        rows={filtered}
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "description", header: "Description", render: (row) => row.description ?? "—" },
          { key: "sortOrder", header: "Order", sortable: true },
          {
            key: "isActive",
            header: "Status",
            render: (row) =>
              row.isActive ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Active</span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">Inactive</span>
              ),
          },
          {
            key: "edit",
            header: "Edit",
            render: (row) => (
              <button
                className="text-[var(--brand)] hover:underline"
                onClick={() => {
                  setEditingId(row.id)
                  setName(row.name)
                  setDescription(row.description ?? "")
                  setSortOrder(String(row.sortOrder))
                  setIsActive(row.isActive)
                }}
              >
                Edit
              </button>
            ),
          },
          {
            key: "delete",
            header: "Deactivate",
            render: (row) => (
              <button
                className="text-red-600 hover:underline disabled:opacity-50"
                onClick={() => setConfirmDelete({ id: row.id, name: row.name })}
                disabled={!row.isActive}
              >
                Deactivate
              </button>
            ),
          },
        ]}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading training categories..." : "No training categories found."}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate training category?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete ? (
                <>
                  This will deactivate <strong>{confirmDelete.name}</strong>. Existing OJT checks remain intact, but the
                  category will no longer be selectable on new OJT records. You can reactivate it later by editing.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmDelete && void remove(confirmDelete.id)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
