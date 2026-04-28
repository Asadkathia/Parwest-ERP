"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Save, Shield, Search } from "lucide-react"
import { toast } from "sonner"

import { ACTIONS, MODULES } from "@/lib/constants/permissions"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import { Checkbox } from "@/components/shadcn/checkbox"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/shadcn/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/shadcn/table"
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
} from "@/components/shadcn/alert-dialog"

type ActionName = (typeof ACTIONS)[number]
type PermMap = Record<ActionName, boolean>
type PermsState = Record<string, PermMap>

function emptyPerm(): PermMap {
    return { CREATE: false, VIEW: false, UPDATE: false, DELETE: false, REQUISITIONS: false }
}

function emptyPermsState(): PermsState {
    return Object.fromEntries(MODULES.map((m) => [m, emptyPerm()])) as PermsState
}

function clonePerms(perms: PermsState): PermsState {
    const next: PermsState = {} as PermsState
    for (const m of MODULES) {
        const src = perms[m] ?? emptyPerm()
        next[m] = { ...src }
    }
    return next
}

function permsEqual(a: PermsState, b: PermsState): boolean {
    for (const m of MODULES) {
        const ra = a[m] ?? emptyPerm()
        const rb = b[m] ?? emptyPerm()
        for (const action of ACTIONS) {
            if (Boolean(ra[action]) !== Boolean(rb[action])) return false
        }
    }
    return true
}

type RoleRow = { id: string; name: string; description?: string | null }

interface Props {
    roles: RoleRow[]
}

export default function RolePermissionsManager({ roles }: Props) {
    const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? "")
    const [perms, setPerms] = useState<PermsState>(emptyPermsState)
    const [initialPerms, setInitialPerms] = useState<PermsState>(emptyPermsState)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [query, setQuery] = useState("")
    const [discardOpen, setDiscardOpen] = useState(false)

    useEffect(() => {
        if (!selectedRoleId) return
        let cancelled = false
        setLoading(true)
        fetch(`/api/role-permissions?roleId=${selectedRoleId}`)
            .then((r) => (r.ok ? r.json() : []))
            .then(
                (
                    data: Array<{
                        module: string
                        canCreate: boolean
                        canView: boolean
                        canUpdate: boolean
                        canDelete: boolean
                        canRequisition: boolean
                    }>,
                ) => {
                    if (cancelled) return
                    const next = emptyPermsState()
                    for (const row of Array.isArray(data) ? data : []) {
                        const mod = String(row.module).toUpperCase()
                        if (!next[mod]) continue
                        next[mod] = {
                            CREATE: Boolean(row.canCreate),
                            VIEW: Boolean(row.canView),
                            UPDATE: Boolean(row.canUpdate),
                            DELETE: Boolean(row.canDelete),
                            REQUISITIONS: Boolean(row.canRequisition),
                        }
                    }
                    setPerms(next)
                    setInitialPerms(clonePerms(next))
                },
            )
            .catch(() => {
                if (cancelled) return
                toast.error("Failed to load role permissions")
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [selectedRoleId])

    const isDirty = useMemo(() => !permsEqual(perms, initialPerms), [perms, initialPerms])

    const toggle = (module: string, action: ActionName) => {
        setPerms((prev) => ({
            ...prev,
            [module]: {
                ...(prev[module] ?? emptyPerm()),
                [action]: !(prev[module]?.[action] ?? false),
            },
        }))
    }

    const toggleAll = (module: string, checked: boolean) => {
        setPerms((prev) => ({
            ...prev,
            [module]: {
                CREATE: checked,
                VIEW: checked,
                UPDATE: checked,
                DELETE: checked,
                REQUISITIONS: checked,
            },
        }))
    }

    const requestCancel = () => {
        if (!isDirty) return
        setDiscardOpen(true)
    }

    const confirmDiscard = () => {
        setPerms(clonePerms(initialPerms))
        setDiscardOpen(false)
    }

    const save = async () => {
        if (!selectedRoleId || !isDirty) return
        setSaving(true)
        try {
            const permissions = MODULES.map((module) => {
                const m = perms[module] ?? emptyPerm()
                return {
                    module,
                    canCreate: m.CREATE,
                    canView: m.VIEW,
                    canUpdate: m.UPDATE,
                    canDelete: m.DELETE,
                    canRequisition: m.REQUISITIONS,
                }
            })
            const res = await fetch("/api/role-permissions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roleId: selectedRoleId, permissions }),
            })
            const payload = await res.json().catch(() => ({}))
            if (!res.ok) {
                const message = (payload as { message?: string })?.message ?? "Failed to save"
                throw new Error(message)
            }
            setInitialPerms(clonePerms(perms))
            toast.success("Role permissions updated")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    const visibleModules = useMemo(
        () =>
            MODULES.filter(
                (m) => !query || m.toLowerCase().includes(query.toLowerCase()),
            ),
        [query],
    )

    const selectedRole = roles.find((r) => r.id === selectedRoleId)

    return (
        <Card>
            <CardHeader className="space-y-4">
                <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>Role Permissions</CardTitle>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[220px] space-y-1.5">
                        <Label htmlFor="rbac-role-select">Role</Label>
                        <Select
                            value={selectedRoleId}
                            onValueChange={(v) => setSelectedRoleId(v)}
                        >
                            <SelectTrigger id="rbac-role-select">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                        <Label htmlFor="rbac-module-search">Search module</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="rbac-module-search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Filter modules..."
                                className="pl-8"
                            />
                        </div>
                    </div>
                </div>
                {selectedRole && (
                    <p className="text-sm text-muted-foreground">
                        Permissions configured here apply to <strong>all users</strong> assigned the{" "}
                        <strong>{selectedRole.name}</strong> role. Per-user overrides can be set in
                        Permissions Management.
                    </p>
                )}
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="relative max-h-[60vh] overflow-auto rounded-md border">
                    <Table className="min-w-[720px]">
                        <TableHeader className="sticky top-0 z-20 bg-background">
                            <TableRow>
                                <TableHead className="sticky left-0 z-30 bg-background w-40 border-r">
                                    Module
                                </TableHead>
                                <TableHead className="text-center w-16">All</TableHead>
                                {ACTIONS.map((a) => (
                                    <TableHead key={a} className="text-center">
                                        {a}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={`skel-${i}`}>
                                        <TableCell className="sticky left-0 bg-background border-r">
                                            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="mx-auto h-4 w-4 animate-pulse rounded bg-muted" />
                                        </TableCell>
                                        {ACTIONS.map((a) => (
                                            <TableCell key={a} className="text-center">
                                                <div className="mx-auto h-4 w-4 animate-pulse rounded bg-muted" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : visibleModules.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={ACTIONS.length + 2}
                                        className="text-center text-sm text-muted-foreground py-8"
                                    >
                                        No modules match &quot;{query}&quot;.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visibleModules.map((module) => {
                                    const modulePerms = perms[module] ?? emptyPerm()
                                    const allChecked = ACTIONS.every((a) => modulePerms[a])
                                    const someChecked = ACTIONS.some((a) => modulePerms[a])
                                    const allState: boolean | "indeterminate" = allChecked
                                        ? true
                                        : someChecked
                                            ? "indeterminate"
                                            : false
                                    return (
                                        <TableRow key={module}>
                                            <TableCell className="sticky left-0 z-10 bg-background font-medium border-r">
                                                {module}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center">
                                                    <Checkbox
                                                        checked={allState}
                                                        onCheckedChange={(c) =>
                                                            toggleAll(module, c === true)
                                                        }
                                                        aria-label={`Toggle all permissions for ${module}`}
                                                    />
                                                </div>
                                            </TableCell>
                                            {ACTIONS.map((action) => (
                                                <TableCell key={action} className="text-center">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={modulePerms[action]}
                                                            onCheckedChange={() => toggle(module, action)}
                                                            aria-label={`${module} ${action}`}
                                                        />
                                                    </div>
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={requestCancel}
                        disabled={!isDirty || saving || loading}
                    >
                        Cancel
                    </Button>
                    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Discard unsaved permission changes?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Pending edits to this role&apos;s permissions will be reverted.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDiscard}>Discard</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <PermissionGate module="USERS" action="UPDATE" mode="disable">
                        <Button
                            type="button"
                            variant="default"
                            onClick={save}
                            disabled={!isDirty || saving || loading || !selectedRoleId}
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {saving ? "Saving..." : "Save Permissions"}
                        </Button>
                    </PermissionGate>
                </div>
            </CardContent>
        </Card>
    )
}
