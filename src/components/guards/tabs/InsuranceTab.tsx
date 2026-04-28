"use client"

import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { Input } from "@/components/shadcn/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/shadcn/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/shadcn/dialog"
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/shadcn/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/shadcn/select"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
    TabStatusBadge,
    type TabStatusVariant,
} from "@/components/guards/tabs/status-badge"
import {
    GUARD_INSURANCE_STATUS_LABELS,
    GUARD_INSURANCE_STATUS_VALUES,
    guardInsuranceCreateSchema,
    guardInsuranceEditSchema,
    type GuardInsuranceCreateInput,
    type GuardInsuranceEditInput,
    type GuardInsuranceStatusValue,
} from "@/lib/schemas/guard-insurance"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type ClientInsuranceOption = {
    id: string
    insuranceName: string
    status: string
    client: { id: string; name: string }
}

type GuardInsuranceRecord = {
    id: string
    healthId: string | null
    status: string
    createdAt: string
    clientInsurance: {
        id: string
        insuranceName: string
        client: { id: string; name: string }
    }
    createdBy: { id: string; name: string } | null
}

interface InsuranceTabProps {
    insurance?: GuardLooseRow[]
    guardId: string
    parwestId?: string
    canCreate?: boolean
    canUpdate?: boolean
    canDelete?: boolean
}

/** Read a JSON error envelope and return its message field. */
async function readErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const data = (await res.json()) as { message?: unknown }
        if (data && typeof data.message === "string" && data.message.length > 0) {
            return data.message
        }
    } catch {
        /* ignore */
    }
    return fallback
}

/** Map an insurance assignment status to a TabStatusBadge variant + label. */
function badgeForStatus(status: string): { label: string; variant: TabStatusVariant } {
    const upper = String(status || "").toUpperCase()
    if (upper === "ACTIVE") return { label: "Active", variant: "success" }
    if (upper === "INACTIVE") return { label: "Inactive", variant: "muted" }
    if (upper === "PENDING") return { label: "Pending", variant: "warning" }
    if (upper === "CANCELLED") return { label: "Cancelled", variant: "muted" }
    if (upper === "EXPIRED") return { label: "Expired", variant: "destructive" }
    return { label: upper || "Unknown", variant: "muted" }
}

export default function InsuranceTab({
    guardId,
    parwestId,
    canCreate = false,
    canUpdate = false,
    canDelete = false,
}: InsuranceTabProps) {
    const [records, setRecords] = useState<GuardInsuranceRecord[]>([])
    const [loading, setLoading] = useState(true)

    // Create dialog state
    const [createOpen, setCreateOpen] = useState(false)
    const [clientInsurances, setClientInsurances] = useState<ClientInsuranceOption[]>([])
    const [insLoading, setInsLoading] = useState(false)

    // Edit dialog state
    const [editTarget, setEditTarget] = useState<GuardInsuranceRecord | null>(null)

    // Delete dialog state
    const [deleteTarget, setDeleteTarget] = useState<GuardInsuranceRecord | null>(null)
    const [deleting, setDeleting] = useState(false)

    const createForm = useForm<GuardInsuranceCreateInput>({
        resolver: zodResolver(guardInsuranceCreateSchema),
        defaultValues: { clientInsuranceId: "", healthId: "" },
    })

    const editForm = useForm<GuardInsuranceEditInput>({
        resolver: zodResolver(guardInsuranceEditSchema),
        defaultValues: { healthId: "", status: "ACTIVE" },
    })

    const fetchRecords = useCallback(async () => {
        if (!guardId) return
        setLoading(true)
        try {
            const res = await fetch(`/api/guards/${guardId}/insurance`)
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to load insurance records")
                toast.error(msg)
                setRecords([])
                return
            }
            const data = await res.json()
            setRecords(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load insurance records")
            setRecords([])
        } finally {
            setLoading(false)
        }
    }, [guardId])

    useEffect(() => {
        void fetchRecords()
    }, [fetchRecords])

    // ── Create ─────────────────────────────────────────────────────────────
    const openCreateDialog = async () => {
        createForm.reset({ clientInsuranceId: "", healthId: "" })
        setCreateOpen(true)
        setInsLoading(true)
        try {
            const res = await fetch("/api/client-insurances?status=ACTIVE")
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to load client insurances")
                toast.error(msg)
                setClientInsurances([])
                return
            }
            const data = await res.json()
            setClientInsurances(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load client insurances")
            setClientInsurances([])
        } finally {
            setInsLoading(false)
        }
    }

    const handleCreateSubmit = createForm.handleSubmit(async (values) => {
        try {
            const res = await fetch(`/api/guards/${guardId}/insurance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientInsuranceId: values.clientInsuranceId,
                    healthId: values.healthId || "",
                }),
            })
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to assign insurance")
                toast.error(msg)
                return
            }
            toast.success("Insurance policy assigned")
            setCreateOpen(false)
            await fetchRecords()
        } catch {
            toast.error("Failed to assign insurance")
        }
    })

    // ── Edit ───────────────────────────────────────────────────────────────
    const openEditDialog = (record: GuardInsuranceRecord) => {
        const status: GuardInsuranceStatusValue = GUARD_INSURANCE_STATUS_VALUES.includes(
            record.status as GuardInsuranceStatusValue
        )
            ? (record.status as GuardInsuranceStatusValue)
            : "ACTIVE"
        editForm.reset({
            healthId: record.healthId ?? "",
            status,
        })
        setEditTarget(record)
    }

    const handleEditSubmit = editForm.handleSubmit(async (values) => {
        if (!editTarget) return
        try {
            const res = await fetch(
                `/api/guards/${guardId}/insurance/${editTarget.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        healthId: values.healthId || "",
                        status: values.status,
                    }),
                }
            )
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to update insurance")
                toast.error(msg)
                return
            }
            toast.success("Insurance policy updated")
            setEditTarget(null)
            await fetchRecords()
        } catch {
            toast.error("Failed to update insurance")
        }
    })

    // ── Delete ─────────────────────────────────────────────────────────────
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        try {
            const res = await fetch(
                `/api/guards/${guardId}/insurance/${deleteTarget.id}`,
                { method: "DELETE" }
            )
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to delete policy")
                toast.error(msg)
                return
            }
            toast.success("Insurance policy deleted")
            setDeleteTarget(null)
            await fetchRecords()
        } catch {
            toast.error("Failed to delete policy")
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-20 font-bold">Guard Insurance</h2>
                    <p className="text-sm text-muted-foreground">
                        Insurance policies assigned to this guard.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {canCreate && (
                        <PermissionGate module="GUARDS" action="CREATE" mode="hide">
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => void openCreateDialog()}
                            >
                                <Plus className="mr-1 h-4 w-4" />
                                Add Policy
                            </Button>
                        </PermissionGate>
                    )}
                </div>
            </div>

            {/* List */}
            {loading ? (
                <Card>
                    <CardContent className="p-12 text-center text-sm text-muted-foreground">
                        Loading insurance policies...
                    </CardContent>
                </Card>
            ) : records.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-sm text-muted-foreground">
                        No insurance policies
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Parwest ID</TableHead>
                                    <TableHead>Health ID</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Insurance</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.map((rec) => {
                                    const badge = badgeForStatus(rec.status)
                                    return (
                                        <TableRow key={rec.id}>
                                            <TableCell className="font-mono text-xs tabular-nums">
                                                {parwestId || "—"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs tabular-nums">
                                                {rec.healthId || "—"}
                                            </TableCell>
                                            <TableCell>
                                                {rec.clientInsurance.client.name}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {rec.clientInsurance.insuranceName}
                                            </TableCell>
                                            <TableCell>
                                                <TabStatusBadge
                                                    label={badge.label}
                                                    variant={badge.variant}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    {canUpdate && (
                                                        <PermissionGate
                                                            module="GUARDS"
                                                            action="UPDATE"
                                                            mode="hide"
                                                        >
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => openEditDialog(rec)}
                                                                title="Edit policy"
                                                            >
                                                                <Pencil className="mr-1 h-3.5 w-3.5" />
                                                                Edit
                                                            </Button>
                                                        </PermissionGate>
                                                    )}
                                                    {canDelete && (
                                                        <PermissionGate
                                                            module="GUARDS"
                                                            action="DELETE"
                                                            mode="hide"
                                                        >
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    setDeleteTarget(rec)
                                                                }
                                                                title="Delete policy"
                                                                className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                            >
                                                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                                Delete
                                                            </Button>
                                                        </PermissionGate>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Create dialog */}
            <Dialog
                open={createOpen}
                onOpenChange={(open) => {
                    if (!open) setCreateOpen(false)
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add insurance policy</DialogTitle>
                        <DialogDescription>
                            Assign an active client insurance to this guard.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...createForm}>
                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <FormField
                                control={createForm.control}
                                name="clientInsuranceId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Client insurance{" "}
                                            <span className="text-rose-500">*</span>
                                        </FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            disabled={insLoading}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue
                                                        placeholder={
                                                            insLoading
                                                                ? "Loading..."
                                                                : "Select client insurance"
                                                        }
                                                    />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {clientInsurances.length === 0 && !insLoading ? (
                                                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                                        No active client insurances available
                                                    </div>
                                                ) : (
                                                    clientInsurances.map((ci) => (
                                                        <SelectItem key={ci.id} value={ci.id}>
                                                            {ci.client.name} — {ci.insuranceName}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={createForm.control}
                                name="healthId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Health ID</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Enter Health ID"
                                                className="font-mono tabular-nums"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setCreateOpen(false)}
                                    disabled={createForm.formState.isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        createForm.formState.isSubmitting ||
                                        !createForm.formState.isDirty
                                    }
                                >
                                    {createForm.formState.isSubmitting
                                        ? "Saving..."
                                        : "Save Policy"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog
                open={!!editTarget}
                onOpenChange={(open) => {
                    if (!open) setEditTarget(null)
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit insurance policy</DialogTitle>
                        <DialogDescription>
                            {editTarget
                                ? `${editTarget.clientInsurance.client.name} — ${editTarget.clientInsurance.insuranceName}`
                                : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...editForm}>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <FormField
                                control={editForm.control}
                                name="healthId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Health ID</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Enter Health ID"
                                                className="font-mono tabular-nums"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={editForm.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Status <span className="text-rose-500">*</span>
                                        </FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={(v) =>
                                                field.onChange(v as GuardInsuranceStatusValue)
                                            }
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {GUARD_INSURANCE_STATUS_VALUES.map((value) => (
                                                    <SelectItem key={value} value={value}>
                                                        {GUARD_INSURANCE_STATUS_LABELS[value]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditTarget(null)}
                                    disabled={editForm.formState.isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        editForm.formState.isSubmitting ||
                                        !editForm.formState.isDirty
                                    }
                                >
                                    {editForm.formState.isSubmitting
                                        ? "Saving..."
                                        : "Save Policy"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete insurance policy?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="block">
                                <span className="font-medium text-foreground">
                                    {deleteTarget?.clientInsurance.insuranceName ?? ""}
                                </span>{" "}
                                from{" "}
                                <span className="font-medium text-foreground">
                                    {deleteTarget?.clientInsurance.client.name ?? ""}
                                </span>
                                {deleteTarget?.healthId ? (
                                    <>
                                        {" "}
                                        (Health ID:{" "}
                                        <span className="font-mono">
                                            {deleteTarget.healthId}
                                        </span>
                                        )
                                    </>
                                ) : null}{" "}
                                will be permanently removed from this guard. This action
                                cannot be undone.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Keep policy</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? "Deleting..." : "Delete Policy"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
