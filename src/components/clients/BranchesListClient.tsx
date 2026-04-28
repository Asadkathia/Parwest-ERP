"use client"

/**
 * Parwest ERP — Branches List Client
 * ─────────────────────────────────────────────────────────────────────────
 * Phase 4B follow-up reskin. shadcn DataTable + filters wired to URL search
 * params (preserving the legacy `?type=...` contract). The server component
 * (`branches/page.tsx`) re-runs its scoped Prisma query on URL change.
 *
 * Region scope is enforced server-side; do not move that logic here.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Building, Loader2 } from "lucide-react"

import { Badge } from "@/components/shadcn/badge"
import { Card, CardContent } from "@/components/shadcn/card"
import { DataTable } from "@/components/shadcn/data-table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/shadcn/select"

export type BranchListRow = {
    id: string
    clientId: string
    clientName: string
    name: string
    code: string | null
    address: string | null
    city: string | null
    province: string | null
    regionName: string | null
    branchModel: "CONVENTIONAL" | "ISLAMIC"
    deploymentCount: number
    isHeadOffice: boolean
    status: string
}

const ALL_VALUE = "__ALL__"

const TYPE_OPTIONS = [
    { value: "ISLAMIC", label: "Islamic" },
    { value: "CONVENTIONAL", label: "Conventional" },
]

const STATUS_OPTIONS = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
]

function statusVariant(
    status: string,
): "default" | "secondary" | "destructive" | "outline" {
    switch (status.toUpperCase()) {
        case "ACTIVE":
            return "default"
        case "INACTIVE":
            return "secondary"
        default:
            return "outline"
    }
}

interface Props {
    branches: BranchListRow[]
}

export default function BranchesListClient({ branches }: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = React.useTransition()

    const type = searchParams.get("type") ?? ""
    const status = searchParams.get("status") ?? ""

    const pushParam = React.useCallback(
        (mutator: (params: URLSearchParams) => void) => {
            const params = new URLSearchParams(searchParams.toString())
            mutator(params)
            startTransition(() => {
                router.push(`${pathname}?${params.toString()}`)
            })
        },
        [router, pathname, searchParams],
    )

    const handleType = (val: string) => {
        pushParam((p) => {
            if (val && val !== ALL_VALUE) p.set("type", val)
            else p.delete("type")
        })
    }

    const handleStatus = (val: string) => {
        pushParam((p) => {
            if (val && val !== ALL_VALUE) p.set("status", val)
            else p.delete("status")
        })
    }

    const columns = React.useMemo<ColumnDef<BranchListRow>[]>(
        () => [
            {
                accessorKey: "clientName",
                header: "Client",
                cell: ({ row }) => (
                    <Link
                        href={`/clients/${row.original.clientId}`}
                        className="font-medium text-primary hover:underline"
                    >
                        {row.original.clientName}
                    </Link>
                ),
            },
            {
                accessorKey: "id",
                header: "Branch ID",
                cell: ({ row }) => (
                    <span className="font-mono text-xs">
                        {row.original.id.slice(0, 8)}
                    </span>
                ),
            },
            {
                accessorKey: "name",
                header: "Branch",
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <span className="font-medium">{row.original.name}</span>
                        {row.original.isHeadOffice ? (
                            <Badge variant="default" className="font-normal">
                                Head Office
                            </Badge>
                        ) : null}
                    </div>
                ),
            },
            {
                accessorKey: "address",
                header: "Address",
                cell: ({ row }) => (
                    <span className="text-muted-foreground">
                        {row.original.address || "—"}
                    </span>
                ),
            },
            {
                accessorKey: "city",
                header: "City",
                cell: ({ row }) => row.original.city || "—",
            },
            {
                accessorKey: "regionName",
                header: "Region",
                cell: ({ row }) =>
                    row.original.regionName ? (
                        <Badge variant="outline">{row.original.regionName}</Badge>
                    ) : (
                        <span className="text-muted-foreground">—</span>
                    ),
            },
            {
                accessorKey: "deploymentCount",
                header: () => <span className="block text-end">Guards</span>,
                cell: ({ row }) => (
                    <div className="text-end tabular-nums">
                        {row.original.deploymentCount}
                    </div>
                ),
            },
            {
                accessorKey: "status",
                header: "Status",
                cell: ({ row }) => (
                    <Badge variant={statusVariant(row.original.status)}>
                        {row.original.status}
                    </Badge>
                ),
            },
            {
                id: "actions",
                header: "",
                enableHiding: false,
                cell: ({ row }) => (
                    <Link
                        href={`/clients/branches/${row.original.id}`}
                        className="text-primary hover:underline font-medium"
                    >
                        View
                    </Link>
                ),
            },
        ],
        [],
    )

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                    <label className="mb-1 block text-sm text-muted-foreground">
                        Branch Model
                    </label>
                    <Select
                        value={type || ALL_VALUE}
                        onValueChange={handleType}
                        disabled={isPending}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="All Models" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>All Models</SelectItem>
                            {TYPE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <label className="mb-1 block text-sm text-muted-foreground">
                        Status
                    </label>
                    <Select
                        value={status || ALL_VALUE}
                        onValueChange={handleStatus}
                        disabled={isPending}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>All Status</SelectItem>
                            {STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {isPending ? (
                    <div className="flex items-end gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                    </div>
                ) : null}
            </div>

            <div className="text-xs text-muted-foreground">
                {branches.length} branch{branches.length !== 1 ? "es" : ""} found
            </div>

            {branches.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <Building className="h-8 w-8 text-muted-foreground" aria-hidden />
                        <div className="text-base font-semibold">No branches found</div>
                        <p className="max-w-md text-sm text-muted-foreground">
                            Branches will appear here once clients add them.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <DataTable
                    columns={columns}
                    data={branches}
                    searchKey="name"
                    searchPlaceholder="Filter visible rows by name…"
                    pageSize={25}
                    enableColumnVisibility
                    emptyMessage="No branches match the on-page filter."
                />
            )}
        </div>
    )
}
