"use client"
import { useMemo } from "react"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shadcn/tooltip"
import { CellEditor } from "./cells"
import { RowStatus } from "./RowStatus"
import type { DraftRow, DraftColumn } from "@/lib/imports/client/useDraft"

type DraftGridProps = {
  rows: DraftRow[]
  columns: DraftColumn[]
  onPatchRow: (rowNumber: number, data: Record<string, unknown>) => Promise<unknown>
  onToggleSkip: (rowNumber: number, skipped: boolean) => Promise<unknown>
}

export function DraftGrid({ rows, columns, onPatchRow, onToggleSkip }: DraftGridProps) {
  const tableColumns = useMemo<ColumnDef<DraftRow>[]>(() => [
    {
      id: "row",
      header: "Row",
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.rowNumber}</span>,
      size: 56,
    },
    ...columns.map((col): ColumnDef<DraftRow> => ({
      id: col.key,
      header: col.label,
      cell: ({ row }) => <Cell row={row.original} col={col} onPatchRow={onPatchRow} />,
    })),
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <RowStatus row={row.original} onToggleSkip={(s) => onToggleSkip(row.original.rowNumber, s)} />,
    },
  ], [columns, onPatchRow, onToggleSkip])

  const table = useReactTable({ data: rows, columns: tableColumns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="overflow-auto rounded-md border max-h-[70vh]">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-muted sticky top-0 z-10">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground border-b border-r last:border-r-0"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr
              key={r.id}
              className={
                r.original.skipped
                  ? "bg-muted/30 text-muted-foreground"
                  : "hover:bg-muted/20"
              }
            >
              {r.getVisibleCells().map((c) => (
                <td
                  key={c.id}
                  className="border-b border-r last:border-r-0 px-2 py-1 align-middle min-w-[140px]"
                >
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Cell({
  row, col, onPatchRow,
}: { row: DraftRow; col: DraftColumn; onPatchRow: (rn: number, d: Record<string, unknown>) => Promise<unknown> }) {
  const cellError = row.errors.find((e) =>
    e.field === col.key || e.field === col.header || e.field.split("+").includes(col.key) || e.field.split("+").includes(col.header)
  )
  const invalid = Boolean(cellError)
  // Edit/read under the SHEET HEADER key — the key the parsed row data actually
  // uses. Writing under col.key (the canonical key) created a parallel key, and
  // header-alias collapsing could then let the original value clobber the edit
  // (row data is JSONB, which drops insertion order) — silently losing edits.
  const onCommit = (next: string | null) => onPatchRow(row.rowNumber, { [col.header]: next })
  const editor = (
    <CellEditor
      column={col}
      value={row.data[col.header] ?? row.data[col.key]}
      onCommit={onCommit}
      invalid={invalid}
    />
  )
  if (!invalid) return editor
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full">{editor}</div>
        </TooltipTrigger>
        <TooltipContent>{cellError!.message}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
