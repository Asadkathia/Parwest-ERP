"use client"

/**
 * Parwest ERP — Branch Delete Button (Phase 4B follow-up reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * shadcn AlertDialog destructive flow. Replaces the legacy `confirm()`
 * pattern. Server enforces "cannot delete with active deployments"; we
 * surface the active deployment count up front so users know the impact
 * before they confirm.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/shadcn/button"
import { PermissionGate } from "@/components/shadcn/permission-gate"
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

interface Props {
    branchId: string
    clientId: string
    branchName: string
    activeDeploymentCount: number
}

export default function BranchDeleteButton({
    branchId,
    clientId,
    branchName,
    activeDeploymentCount,
}: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [pending, startTransition] = useTransition()

    const handleDelete = async () => {
        try {
            const response = await fetch(`/api/branches/${branchId}`, {
                method: "DELETE",
            })
            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                const msg =
                    (data && typeof data === "object" && "message" in data && typeof data.message === "string"
                        ? data.message
                        : null) || "Failed to delete branch"
                toast.error(msg)
                return
            }

            toast.success("Branch deleted")
            setOpen(false)
            startTransition(() => {
                router.push(`/clients/${clientId}?tab=branches`)
                router.refresh()
            })
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unexpected error"
            toast.error(msg)
        }
    }

    const impact =
        activeDeploymentCount > 0
            ? `${activeDeploymentCount} guard${activeDeploymentCount === 1 ? " is" : "s are"} deployed at this branch — the server will block deletion until they are reassigned.`
            : "No active deployments at this branch."

    return (
        <PermissionGate module="CLIENTS" action="DELETE" mode="hide">
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete branch?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="block">
                                You are about to delete{" "}
                                <span className="font-medium text-foreground">{branchName}</span>. This
                                action cannot be undone.
                            </span>
                            <span className="mt-2 block text-sm">{impact}</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep branch</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={pending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Branch
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGate>
    )
}
