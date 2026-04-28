"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
    CheckCircle2,
    Clock,
    Eye,
    FileText,
    RotateCcw,
    ShieldCheck,
    Upload,
    XCircle,
} from "lucide-react"

import { Button } from "@/components/shadcn/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/shadcn/card"
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
import { Input } from "@/components/shadcn/input"
import { Textarea } from "@/components/shadcn/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/shadcn/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
    TabStatusBadge,
    type TabStatusVariant,
} from "@/components/guards/tabs/status-badge"
import {
    VERIFICATION_STATUS_LABELS,
    VERIFICATION_STATUS_VALUES,
    deriveSimpleStatus,
    guardPrerequisiteVerifySchema,
    type GuardPrerequisiteVerifyInput,
    type VerificationStatusValue,
} from "@/lib/schemas/guard-prerequisite"

type PrereqRow = {
    docTypeId: string
    docTypeName: string
    isActive: boolean
    docCategory: string
    isSystemGenerated: boolean
    prereqId: string | null
    status: string
    verificationStatus: string | null
    hasAttachment: boolean
    attachmentName: string | null
    documentUrl: string | null
    uploadedBy: string | null
    uploadedAt: string | null
    verifiedAt: string | null
    verifiedBy: string | null
    editedBy: string | null
    editedAt: string | null
    expiryDate: string | null
    comments: string | null
    updatedAt: string | null
}

interface VerificationTabProps {
    guardId: string
    canCreate?: boolean
    canUpdate?: boolean
}

function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(file)
    })
}

async function viewDocument(guardId: string, row: PrereqRow) {
    let data: string | null = row.documentUrl
    if (!data && row.hasAttachment && row.prereqId) {
        try {
            const res = await fetch(`/api/guards/${guardId}/prerequisites/${row.prereqId}`)
            if (!res.ok) return
            const payload = await res.json()
            data = payload.attachmentData || payload.documentUrl
        } catch {
            return
        }
    }
    if (!data) return
    const win = window.open()
    if (!win) return
    if (data.startsWith("data:")) {
        win.document.write(
            `<html><body style="margin:0"><iframe src="${data}" width="100%" height="100%" style="border:none"></iframe></body></html>`
        )
    } else {
        win.location.href = data
    }
}

function formatDate(d: string | null) {
    return d
        ? new Date(d).toLocaleDateString("en-PK", {
              year: "numeric",
              month: "short",
              day: "numeric",
          })
        : "—"
}

/** Map row status/verificationStatus + file presence to a TabStatusBadge label+variant. */
function badgeForRow(row: PrereqRow): { label: string; variant: TabStatusVariant } {
    const hasFile = row.hasAttachment || !!row.documentUrl
    if (!hasFile) return { label: "Not Uploaded", variant: "warning" }
    if (row.status === "VERIFIED" || row.verificationStatus === "VERIFIED") {
        return { label: "Verified", variant: "success" }
    }
    if (row.status === "REJECTED" || row.verificationStatus === "NON_VERIFIED") {
        return { label: "Rejected", variant: "destructive" }
    }
    if (row.verificationStatus) {
        const label =
            VERIFICATION_STATUS_LABELS[row.verificationStatus as VerificationStatusValue] ??
            row.verificationStatus
        return { label, variant: "info" }
    }
    return { label: "Uploaded — Pending", variant: "warning" }
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

export default function VerificationTab({
    guardId,
    canCreate = false,
    canUpdate = false,
}: VerificationTabProps) {
    const [rows, setRows] = useState<PrereqRow[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState<string | null>(null)
    const [pendingUploadDocType, setPendingUploadDocType] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Verification dialog state
    const [verifyTarget, setVerifyTarget] = useState<PrereqRow | null>(null)
    const [saving, setSaving] = useState(false)

    // Reject confirmation state
    const [rejectTarget, setRejectTarget] = useState<PrereqRow | null>(null)
    const [rejecting, setRejecting] = useState(false)

    // Reset confirmation state
    const [resetTarget, setResetTarget] = useState<PrereqRow | null>(null)
    const [resetting, setResetting] = useState(false)

    const verifyForm = useForm<GuardPrerequisiteVerifyInput>({
        resolver: zodResolver(guardPrerequisiteVerifySchema),
        defaultValues: { verificationStatus: "VERIFIED", expiryDate: "", comments: "" },
    })

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/guards/${guardId}/prerequisites`)
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to load verification data")
                toast.error(msg)
                setRows([])
                return
            }
            const data: PrereqRow[] = await res.json()
            setRows(
                Array.isArray(data)
                    ? data.filter((r) => r.docCategory === "VERIFICATION" && r.isActive)
                    : []
            )
        } catch {
            toast.error("Failed to load verification data")
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [guardId])

    useEffect(() => {
        void load()
    }, [load])

    // ── Upload (POST) ──────────────────────────────────────────────────────
    const handleUploadClick = (docTypeName: string) => {
        setPendingUploadDocType(docTypeName)
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !pendingUploadDocType) return
        e.target.value = ""
        setUploading(pendingUploadDocType)
        try {
            const base64 = await readFileAsBase64(file)
            const res = await fetch(`/api/guards/${guardId}/prerequisites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    docTypeName: pendingUploadDocType,
                    attachmentData: base64,
                    attachmentName: file.name,
                }),
            })
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to upload document")
                toast.error(msg)
                return
            }
            toast.success("Document uploaded")
            await load()
        } catch {
            toast.error("Failed to upload document")
        } finally {
            setUploading(null)
            setPendingUploadDocType(null)
        }
    }

    // ── Open verify dialog ─────────────────────────────────────────────────
    const openVerifyDialog = (row: PrereqRow) => {
        const initialStatus =
            (row.verificationStatus as VerificationStatusValue | null) ?? "VERIFIED"
        verifyForm.reset({
            verificationStatus: VERIFICATION_STATUS_VALUES.includes(initialStatus)
                ? initialStatus
                : "VERIFIED",
            expiryDate: row.expiryDate ? row.expiryDate.split("T")[0] : "",
            comments: row.comments || "",
        })
        setVerifyTarget(row)
    }

    // ── Submit verify dialog (PATCH) ───────────────────────────────────────
    const handleVerifySubmit = verifyForm.handleSubmit(async (values) => {
        if (!verifyTarget?.prereqId) return
        setSaving(true)
        try {
            const res = await fetch(
                `/api/guards/${guardId}/prerequisites/${verifyTarget.prereqId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        status: deriveSimpleStatus(values.verificationStatus),
                        verificationStatus: values.verificationStatus,
                        comments: values.comments || null,
                        expiryDate: values.expiryDate || null,
                    }),
                }
            )
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to save verification")
                toast.error(msg)
                return
            }
            toast.success("Verification updated")
            setVerifyTarget(null)
            await load()
        } catch {
            toast.error("Failed to save verification")
        } finally {
            setSaving(false)
        }
    })

    // ── Quick Reject (PATCH) ───────────────────────────────────────────────
    const handleConfirmReject = async () => {
        if (!rejectTarget?.prereqId) return
        setRejecting(true)
        try {
            const res = await fetch(
                `/api/guards/${guardId}/prerequisites/${rejectTarget.prereqId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        status: "REJECTED",
                        verificationStatus: "NON_VERIFIED",
                    }),
                }
            )
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to reject document")
                toast.error(msg)
                return
            }
            toast.success("Document marked as rejected")
            setRejectTarget(null)
            await load()
        } catch {
            toast.error("Failed to reject document")
        } finally {
            setRejecting(false)
        }
    }

    // ── Reset to PENDING (PATCH) ───────────────────────────────────────────
    const handleConfirmReset = async () => {
        if (!resetTarget?.prereqId) return
        setResetting(true)
        try {
            const res = await fetch(
                `/api/guards/${guardId}/prerequisites/${resetTarget.prereqId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        status: "PENDING",
                        verificationStatus: null,
                    }),
                }
            )
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to reset verification")
                toast.error(msg)
                return
            }
            toast.success("Verification reset to pending")
            setResetTarget(null)
            await load()
        } catch {
            toast.error("Failed to reset verification")
        } finally {
            setResetting(false)
        }
    }

    // ── Derived counts ─────────────────────────────────────────────────────
    const verifiedCount = rows.filter((r) => r.status === "VERIFIED").length
    const uploadedCount = rows.filter((r) => r.hasAttachment || r.documentUrl).length
    const pendingCount = rows.filter(
        (r) => r.isActive && !(r.hasAttachment || r.documentUrl)
    ).length

    if (loading) {
        return (
            <Card>
                <CardContent className="p-12 text-center text-sm text-muted-foreground">
                    Loading verifications...
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-20 font-bold">Verification Status</h2>
                    <p className="text-sm text-muted-foreground">
                        Verification documents and their workflow status.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <TabStatusBadge
                        label={`Verified ${verifiedCount}/${rows.length}`}
                        variant="success"
                    />
                    <TabStatusBadge label={`Uploaded ${uploadedCount}`} variant="info" />
                    {pendingCount > 0 && (
                        <TabStatusBadge
                            label={`${pendingCount} missing`}
                            variant="warning"
                        />
                    )}
                </div>
            </div>

            {/* Workflow alert */}
            {rows.length > 0 && verifiedCount < rows.length && (
                <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertTitle>Guard status is PENDING</AlertTitle>
                    <AlertDescription>
                        {rows.length - verifiedCount} verification
                        {rows.length - verifiedCount === 1 ? "" : "s"} not yet complete.
                        Guard cannot be deployed until all verifications are done.
                    </AlertDescription>
                </Alert>
            )}
            {rows.length > 0 && verifiedCount === rows.length && (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertTitle>All verifications complete</AlertTitle>
                    <AlertDescription>
                        Guard is eligible for deployment.
                    </AlertDescription>
                </Alert>
            )}

            {/* Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Verification Documents</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Document</TableHead>
                                <TableHead>File</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Uploaded</TableHead>
                                <TableHead>Verified</TableHead>
                                <TableHead>Edited</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={9}
                                        className="py-10 text-center text-sm text-muted-foreground"
                                    >
                                        No verification document types configured. Go to{" "}
                                        <strong>Guards → Prerequisites</strong> and add
                                        document types with category{" "}
                                        <em>Verification Document</em>.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, idx) => {
                                    const hasFile = row.hasAttachment || !!row.documentUrl
                                    const isUploadingThis = uploading === row.docTypeName
                                    const badge = badgeForRow(row)
                                    const isFinalised =
                                        row.status === "VERIFIED" ||
                                        row.status === "REJECTED"
                                    return (
                                        <TableRow key={row.docTypeId}>
                                            <TableCell className="text-muted-foreground tabular-nums">
                                                {idx + 1}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {row.docTypeName}
                                            </TableCell>
                                            <TableCell>
                                                {hasFile ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void viewDocument(guardId, row)
                                                        }
                                                        className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline"
                                                    >
                                                        <FileText className="h-3 w-3" />
                                                        {row.attachmentName || "View"}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">
                                                        Not uploaded
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <TabStatusBadge
                                                    label={badge.label}
                                                    variant={badge.variant}
                                                />
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {row.uploadedBy || "—"}
                                                {row.uploadedAt && (
                                                    <div className="text-[11px] text-muted-foreground/80">
                                                        {formatDate(row.uploadedAt)}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {row.verifiedBy || "—"}
                                                {row.verifiedAt && (
                                                    <div className="text-[11px] text-muted-foreground/80">
                                                        {formatDate(row.verifiedAt)}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {row.editedBy || "—"}
                                                {row.editedAt && (
                                                    <div className="text-[11px] text-muted-foreground/80">
                                                        {formatDate(row.editedAt)}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                                                {formatDate(row.expiryDate)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    {canCreate && (
                                                        <PermissionGate
                                                            module="GUARDS"
                                                            action="CREATE"
                                                            mode="disable"
                                                        >
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    handleUploadClick(
                                                                        row.docTypeName
                                                                    )
                                                                }
                                                                disabled={isUploadingThis}
                                                                title={
                                                                    hasFile
                                                                        ? "Replace document"
                                                                        : "Upload document"
                                                                }
                                                            >
                                                                <Upload className="mr-1 h-3.5 w-3.5" />
                                                                {isUploadingThis
                                                                    ? "..."
                                                                    : hasFile
                                                                      ? "Replace"
                                                                      : "Upload"}
                                                            </Button>
                                                        </PermissionGate>
                                                    )}
                                                    {canUpdate && (
                                                        <PermissionGate
                                                            module="GUARDS"
                                                            action="UPDATE"
                                                            mode="disable"
                                                        >
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() =>
                                                                    openVerifyDialog(row)
                                                                }
                                                                disabled={!hasFile}
                                                                title={
                                                                    !hasFile
                                                                        ? "Upload document first"
                                                                        : "Set verification status"
                                                                }
                                                            >
                                                                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                                                                {row.prereqId && hasFile
                                                                    ? "Update"
                                                                    : "Verify"}
                                                            </Button>
                                                        </PermissionGate>
                                                    )}
                                                    {canUpdate && hasFile && row.prereqId && row.status !== "REJECTED" && (
                                                        <PermissionGate
                                                            module="GUARDS"
                                                            action="UPDATE"
                                                            mode="disable"
                                                        >
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    setRejectTarget(row)
                                                                }
                                                                title="Mark as rejected"
                                                                className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                            >
                                                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                                                Reject
                                                            </Button>
                                                        </PermissionGate>
                                                    )}
                                                    {canUpdate && hasFile && row.prereqId && isFinalised && (
                                                        <PermissionGate
                                                            module="GUARDS"
                                                            action="UPDATE"
                                                            mode="disable"
                                                        >
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    setResetTarget(row)
                                                                }
                                                                title="Reset to pending"
                                                            >
                                                                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                                                Reset
                                                            </Button>
                                                        </PermissionGate>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Verify dialog */}
            <Dialog
                open={!!verifyTarget}
                onOpenChange={(open) => {
                    if (!open) setVerifyTarget(null)
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Set verification status</DialogTitle>
                        <DialogDescription>
                            {verifyTarget?.docTypeName ?? ""}
                        </DialogDescription>
                    </DialogHeader>

                    {verifyTarget && (verifyTarget.hasAttachment || verifyTarget.documentUrl) && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            onClick={() => void viewDocument(guardId, verifyTarget)}
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            View uploaded document
                        </Button>
                    )}

                    <Form {...verifyForm}>
                        <form onSubmit={handleVerifySubmit} className="space-y-4">
                            <FormField
                                control={verifyForm.control}
                                name="verificationStatus"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Verification status{" "}
                                            <span className="text-rose-500">*</span>
                                        </FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={(v) =>
                                                field.onChange(v as VerificationStatusValue)
                                            }
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {VERIFICATION_STATUS_VALUES.map((value) => (
                                                    <SelectItem key={value} value={value}>
                                                        {VERIFICATION_STATUS_LABELS[value]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={verifyForm.control}
                                name="expiryDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Expiry date (optional)</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={verifyForm.control}
                                name="comments"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Comments</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                rows={3}
                                                placeholder="Optional notes..."
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
                                    onClick={() => setVerifyTarget(null)}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    {saving ? "Saving..." : "Submit"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Reject confirmation */}
            <AlertDialog
                open={!!rejectTarget}
                onOpenChange={(open) => {
                    if (!open) setRejectTarget(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Mark verification as rejected?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="block">
                                <span className="font-medium text-foreground">
                                    {rejectTarget?.docTypeName ?? ""}
                                </span>{" "}
                                will be marked <strong>Non-verified</strong>. The guard&apos;s
                                lifecycle status may flip back to PENDING and they cannot be
                                deployed until all verifications are complete.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={rejecting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmReject}
                            disabled={rejecting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {rejecting ? "Rejecting..." : "Mark Rejected"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reset confirmation */}
            <AlertDialog
                open={!!resetTarget}
                onOpenChange={(open) => {
                    if (!open) setResetTarget(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset verification to pending?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="block">
                                The current verification decision for{" "}
                                <span className="font-medium text-foreground">
                                    {resetTarget?.docTypeName ?? ""}
                                </span>{" "}
                                will be cleared. The document remains uploaded.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmReset}
                            disabled={resetting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {resetting ? "Resetting..." : "Reset"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
