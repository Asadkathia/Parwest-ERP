"use client"

/**
 * Parwest ERP — Invoice list (Phase 5B reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * Reskin of the invoicing essentials list using shadcn DataTable + Badge +
 * ParwestCurrency. Behaviour parity:
 *   - Same `rows` shape (parent fetches and filters by client/period).
 *   - Status filter is a controlled prop driven by the parent (preserves
 *     the existing in-memory filter contract).
 *   - "View" action triggers the existing `onOpenDetail(id)` handler.
 *
 * Out of scope: server-side regional scoping (server-only — unchanged) and
 * the InvoiceComposer (multi-step composer migration).
 */

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { FileText } from "lucide-react"

import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { DataTable } from "@/components/shadcn/data-table"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import { STATUS_OPTIONS, type InvoiceRow } from "./types"

const ALL_VALUE = "__ALL__"

type Props = {
  rows: InvoiceRow[]
  statusFilter: string
  onChangeStatusFilter: (s: string) => void
  onOpenDetail: (id: string) => void
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
    case "ADVANCE_PAID":
      return "default"
    case "OVERDUE":
    case "UNPAID":
    case "VOID":
      return "destructive"
    case "PARTIAL_PAID":
    case "PENDING":
      return "secondary"
    default:
      return "outline"
  }
}

function periodLabel(month: string | Date): string {
  const d = new Date(month)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
}

function dueDateLabel(due: string | null | undefined): string {
  if (!due) return "—"
  const d = new Date(due)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function InvoiceList({
  rows,
  statusFilter,
  onChangeStatusFilter,
  onOpenDetail,
}: Props) {
  const columns = React.useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.invoiceNumber}
          </span>
        ),
      },
      {
        id: "clientName",
        accessorFn: (row) => row.client?.name ?? "",
        header: "Client",
        cell: ({ row }) => row.original.client?.name || "—",
      },
      {
        id: "branchName",
        accessorFn: (row) => row.branch?.name ?? "",
        header: "Branch",
        cell: ({ row }) => row.original.branch?.name || "—",
      },
      {
        accessorKey: "month",
        header: "Period",
        cell: ({ row }) => periodLabel(row.original.month),
      },
      {
        accessorKey: "amount",
        header: () => <span className="block text-end">Amount Due</span>,
        cell: ({ row }) => (
          <div className="text-end">
            <ParwestCurrency value={Number(row.original.amount || 0)} />
          </div>
        ),
      },
      {
        accessorKey: "paidAmount",
        header: () => <span className="block text-end">Amount Paid</span>,
        cell: ({ row }) => (
          <div className="text-end">
            <ParwestCurrency value={Number(row.original.paidAmount || 0)} />
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "dueDate",
        header: "Due",
        cell: ({ row }) => dueDateLabel(row.original.dueDate),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onOpenDetail(row.original.id)
            }}
          >
            View
          </Button>
        ),
      },
    ],
    [onOpenDetail]
  )

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Invoices for selected client / period
          </h3>
          <div className="w-48">
            <Select
              value={statusFilter || ALL_VALUE}
              onValueChange={(val) =>
                onChangeStatusFilter(val === ALL_VALUE ? "" : val)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-10 text-center">
            <FileText
              className="h-8 w-8 text-muted-foreground"
              aria-hidden
            />
            <div className="text-sm font-semibold">No invoices found</div>
            <p className="max-w-md text-xs text-muted-foreground">
              No invoices match the selected client, period, or status. Use the
              composer above to create one or adjust the filters.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            searchKey="invoiceNumber"
            searchPlaceholder="Filter by invoice #…"
            pageSize={25}
            enableColumnVisibility
            emptyMessage="No invoices match the on-page filter."
          />
        )}
      </CardContent>
    </Card>
  )
}
