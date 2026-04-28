/**
 * Parwest ERP — Branch Edit Form (Phase 4B follow-up reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * RHF + zod + shadcn primitives. Reskin only — same fields, same validation
 * rules, same `PATCH /api/branches/[id]` payload as the legacy form.
 *
 * Aux widgets that are NOT migrated (legacy preserved):
 *   - <PhoneInput> — uncontrolled +92-XXX-XXXXXXX formatter, bridged via
 *     change-capture into RHF (same pattern as Phase 8 client edit form).
 */

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ArrowLeft, Save } from "lucide-react"

import PhoneInput from "@/components/ui/PhoneInput"
import { deriveBranchModel } from "@/lib/branches/model"
import { branchEditSchema, type BranchEditForm } from "@/lib/schemas/branch"

import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Textarea } from "@/components/shadcn/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import { PermissionGate } from "@/components/shadcn/permission-gate"
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
} from "@/components/shadcn/alert-dialog"

type Branch = {
    id: string
    clientId: string
    name: string
    code: string | null
    address: string | null
    city: string | null
    province: string | null
    isHeadOffice: boolean
    contactPerson: string | null
    contactPhone: string | null
    contactEmail: string | null
    client: {
        id: string
        name: string
        type?: string | null
    }
}

type Props = {
    branch: Branch
}

export default function BranchEditForm({ branch }: Props) {
    const router = useRouter()
    const branchType = deriveBranchModel(branch.client?.type)
    const [submitting, setSubmitting] = useState(false)
    const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)

    const form = useForm<BranchEditForm>({
        resolver: zodResolver(branchEditSchema),
        mode: "onBlur",
        defaultValues: {
            name: branch.name ?? "",
            code: branch.code ?? "",
            branchType: branchType === "ISLAMIC" ? "ISLAMIC" : "CONVENTIONAL",
            isHeadOffice: branch.isHeadOffice ?? false,
            address: branch.address ?? "",
            city: branch.city ?? "",
            province: branch.province ?? "",
            contactPerson: branch.contactPerson ?? "",
            contactPhone: branch.contactPhone ?? "",
            contactEmail: branch.contactEmail ?? "",
        },
    })

    const onSubmit = async (values: BranchEditForm) => {
        setSubmitting(true)
        try {
            const response = await fetch(`/api/branches/${branch.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...values,
                    isHeadOffice: Boolean(values.isHeadOffice),
                }),
            })
            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                const msg =
                    (data && typeof data === "object" && "message" in data && typeof data.message === "string"
                        ? data.message
                        : null) || "Failed to update branch"
                toast.error(msg)
                setSubmitting(false)
                return
            }

            toast.success("Branch updated")
            // Reset dirty so the discard guard doesn't re-trigger after redirect
            form.reset(values, { keepValues: true })
            router.push(`/clients/branches/${branch.id}`)
            router.refresh()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unexpected error"
            toast.error(msg)
            setSubmitting(false)
        }
    }

    const handleCancel = () => {
        if (form.formState.isDirty) {
            setConfirmDiscardOpen(true)
            return
        }
        router.push(`/clients/branches/${branch.id}`)
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>
                                            Branch Name <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g., Main Branch, Gulberg Branch"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Branch Code</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g., LHR-001, ISB-002"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="branchType"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Branch Model</FormLabel>
                                        <Select
                                            value={field.value ?? "CONVENTIONAL"}
                                            onValueChange={field.onChange}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="CONVENTIONAL">Conventional</SelectItem>
                                                <SelectItem value="ISLAMIC">Islamic</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="isHeadOffice"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(field.value)}
                                                onChange={(e) => field.onChange(e.target.checked)}
                                                className="h-4 w-4 accent-[var(--brand)]"
                                            />
                                            <span className="text-sm text-[var(--text)]">
                                                This is the head office
                                            </span>
                                        </label>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Location Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Location Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Address</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                rows={3}
                                                placeholder="Enter complete address"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>City</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g., Lahore, Karachi"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="province"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Province</FormLabel>
                                        <Select
                                            value={field.value ?? ""}
                                            onValueChange={field.onChange}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select province" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Punjab">Punjab</SelectItem>
                                                <SelectItem value="Sindh">Sindh</SelectItem>
                                                <SelectItem value="KPK">Khyber Pakhtunkhwa</SelectItem>
                                                <SelectItem value="Balochistan">Balochistan</SelectItem>
                                                <SelectItem value="Islamabad">
                                                    Islamabad Capital Territory
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="contactPerson"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Person</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Name of contact person"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="contactPhone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Phone</FormLabel>
                                        <FormControl>
                                            <div
                                                onBlur={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "contactPhone") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                                onChangeCapture={(e) => {
                                                    const target = e.target as HTMLInputElement
                                                    if (target?.name === "contactPhone") {
                                                        field.onChange(target.value)
                                                    }
                                                }}
                                            >
                                                <PhoneInput
                                                    name="contactPhone"
                                                    defaultValue={field.value ?? ""}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="contactEmail"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="branch@example.com"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Form Actions */}
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={submitting}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Cancel
                    </Button>
                    <PermissionGate module="CLIENTS" action="UPDATE" mode="disable">
                        <Button
                            type="submit"
                            disabled={submitting || !form.formState.isDirty}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {submitting ? "Saving…" : "Save Changes"}
                        </Button>
                    </PermissionGate>
                </div>
            </form>

            {/* Discard confirmation */}
            <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Unsaved changes will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => router.push(`/clients/branches/${branch.id}`)}
                        >
                            Discard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Form>
    )
}
