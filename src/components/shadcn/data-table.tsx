/**
 * Parwest ERP — DataTable
 * ─────────────────────────────────────────────────────────────────────────
 * Generic shadcn-style wrapper around TanStack Table v8.
 *
 * Notes for consumers:
 * - For tabular numbers (e.g. salary, counts) add `tabular-nums text-end`
 *   on the column's `meta`/`cell` className. The DataTable itself does NOT
 *   apply tabular-nums globally — it's a column-level decision.
 * - `searchKey` binds the search Input to a single column id; for multi-
 *   column search, write a custom `globalFilterFn` upstream.
 */

"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table"

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Column id to bind to a search input. If omitted, no search is rendered. */
  searchKey?: string
  /** Placeholder for the search input. Defaults to "Search…". */
  searchPlaceholder?: string
  /** Initial page size. Defaults to 25. */
  pageSize?: number
  /** Empty-state message when `data.length === 0`. */
  emptyMessage?: string
  /** Row click handler. */
  onRowClick?: (row: TData) => void
  /** Show row-selection checkboxes column. Default false. */
  enableRowSelection?: boolean
  /** Show column-visibility dropdown. Default true. */
  enableColumnVisibility?: boolean
  /** Called when row selection changes (only when enableRowSelection). */
  onSelectionChange?: (rows: TData[]) => void
  /** Optional class on the toolbar row. */
  toolbarClassName?: string
  /** Optional class on the outer wrapper. */
  className?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search…",
  pageSize = 25,
  emptyMessage = "No data.",
  onRowClick,
  enableRowSelection = false,
  enableColumnVisibility = true,
  onSelectionChange,
  toolbarClassName,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  // Inject a leading selection column when enabled.
  const finalColumns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!enableRowSelection) return columns

    const selectionColumn: ColumnDef<TData, TValue> = {
      id: "__select",
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Select all rows"
          className="h-4 w-4 rounded border-primary accent-primary"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) {
              el.indeterminate = table.getIsSomePageRowsSelected()
            }
          }}
          onChange={(e) =>
            table.toggleAllPageRowsSelected(!!e.target.checked)
          }
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label="Select row"
          className="h-4 w-4 rounded border-primary accent-primary"
          checked={row.getIsSelected()}
          onChange={(e) => row.toggleSelected(!!e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    }
    return [selectionColumn, ...columns]
  }, [columns, enableRowSelection])

  const table = useReactTable({
    data,
    columns: finalColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: { pageSize },
    },
  })

  // Surface selected rows upstream.
  React.useEffect(() => {
    if (!enableRowSelection || !onSelectionChange) return
    const selected = table
      .getSelectedRowModel()
      .rows.map((r) => r.original as TData)
    onSelectionChange(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection, enableRowSelection])

  const filterColumn = searchKey ? table.getColumn(searchKey) : null
  const filterValue =
    (filterColumn?.getFilterValue() as string | undefined) ?? ""

  const pageIndex = table.getState().pagination.pageIndex
  const currentPageSize = table.getState().pagination.pageSize
  const totalRows = table.getFilteredRowModel().rows.length
  const pageCount = table.getPageCount() || 1
  const firstShown = totalRows === 0 ? 0 : pageIndex * currentPageSize + 1
  const lastShown = Math.min((pageIndex + 1) * currentPageSize, totalRows)

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      {(searchKey || enableColumnVisibility) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            toolbarClassName
          )}
        >
          {searchKey && filterColumn && (
            <Input
              placeholder={searchPlaceholder}
              value={filterValue}
              onChange={(e) => filterColumn.setFilterValue(e.target.value)}
              className="h-9 max-w-xs"
            />
          )}
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ms-auto">
                  Columns <ChevronDown className="ms-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter(
                    (column) =>
                      column.getCanHide() && column.id !== "__select"
                  )
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(canSort && "cursor-pointer select-none")}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : "none"
                      }
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {canSort && sorted === "asc" && (
                            <span aria-hidden>↑</span>
                          )}
                          {canSort && sorted === "desc" && (
                            <span aria-hidden>↓</span>
                          )}
                        </span>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={
                    onRowClick
                      ? () => onRowClick(row.original as TData)
                      : undefined
                  }
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={finalColumns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="tabular-nums">
          {totalRows === 0
            ? "Showing 0 of 0"
            : `Showing ${firstShown}–${lastShown} of ${totalRows}`}
        </div>
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
