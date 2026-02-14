"use client"

import { ReactNode, useMemo, useState } from "react"

type Column<T> = {
    key: keyof T | string
    header: string
    className?: string
    render?: (row: T) => ReactNode
    sortable?: boolean
}

interface DataTableProps<T> {
    rows: T[]
    columns: Column<T>[]
    getRowKey?: (row: T, index: number) => string
    rowKey?: keyof T | string
    searchable?: boolean
    searchPlaceholder?: string
    emptyText?: string
    pageSize?: number
    density?: "compact" | "comfortable"
    stickyHeader?: boolean
    rowHover?: boolean
    emptyVariant?: "plain" | "card"
}

export default function DataTable<T extends Record<string, any>>({
    rows,
    columns,
    getRowKey,
    rowKey,
    searchable = true,
    searchPlaceholder = "Search...",
    emptyText = "No records found.",
    pageSize = 10,
    density = "comfortable",
    stickyHeader = false,
    rowHover = true,
    emptyVariant = "plain",
}: DataTableProps<T>) {
    const [query, setQuery] = useState("")
    const [page, setPage] = useState(1)
    const [sortKey, setSortKey] = useState<string>("")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

    const filteredRows = useMemo(() => {
        if (!query.trim()) return rows
        const lowered = query.toLowerCase()

        return rows.filter((row) =>
            Object.values(row).some((value) =>
                String(value ?? "").toLowerCase().includes(lowered)
            )
        )
    }, [rows, query])

    const sortedRows = useMemo(() => {
        if (!sortKey) return filteredRows

        return [...filteredRows].sort((a, b) => {
            const av = String(a[sortKey] ?? "")
            const bv = String(b[sortKey] ?? "")
            const compare = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" })
            return sortDir === "asc" ? compare : -compare
        })
    }, [filteredRows, sortDir, sortKey])

    const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
    const safePage = Math.min(page, pageCount)
    const start = (safePage - 1) * pageSize
    const currentRows = sortedRows.slice(start, start + pageSize)

    const toggleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
            return
        }
        setSortKey(key)
        setSortDir("asc")
    }

    const resolveRowKey = (row: T, index: number) => {
        if (getRowKey) return getRowKey(row, index)
        if (rowKey && row[rowKey as keyof T] != null) return String(row[rowKey as keyof T])
        if (row.id != null) return String(row.id)
        return String(index)
    }

    return (
        <div className="ui-card overflow-hidden">
            {searchable && (
                <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-muted)]">
                    <input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value)
                            setPage(1)
                        }}
                        placeholder={searchPlaceholder}
                        className="ui-input w-full md:w-80"
                    />
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className={`bg-[var(--surface-muted)] border-b border-[var(--border)] ${stickyHeader ? "sticky top-0 z-10" : ""}`}>
                        <tr>
                            {columns.map((column) => (
                                <th key={String(column.key)} className={`px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase ${column.className || ""}`}>
                                    {column.sortable ? (
                                        <button className="inline-flex items-center gap-1" onClick={() => toggleSort(String(column.key))}>
                                            <span>{column.header}</span>
                                            {sortKey === column.key && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                                        </button>
                                    ) : (
                                        column.header
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {currentRows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-8 text-center text-sm text-[var(--text-muted)]">
                                    {emptyVariant === "card" ? (
                                        <div className="inline-block rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                                            {emptyText}
                                        </div>
                                    ) : (
                                        emptyText
                                    )}
                                </td>
                            </tr>
                        ) : (
                            currentRows.map((row, index) => (
                                <tr key={resolveRowKey(row, index)} className={rowHover ? "hover:bg-[var(--surface-muted)]" : ""}>
                                    {columns.map((column) => (
                                        <td
                                            key={String(column.key)}
                                            className={`${density === "compact" ? "px-6 py-2.5" : "px-6 py-4"} text-sm`}
                                        >
                                            {column.render ? column.render(row) : String(row[column.key] ?? "—")}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-between text-sm">
                <span>
                    Showing {currentRows.length === 0 ? 0 : start + 1} to {Math.min(start + currentRows.length, sortedRows.length)} of {sortedRows.length}
                </span>
                <div className="flex gap-2">
                    <button
                        className="ui-btn ui-btn-secondary py-1.5 disabled:opacity-50"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                    >
                        Previous
                    </button>
                    <button
                        className="ui-btn ui-btn-secondary py-1.5 disabled:opacity-50"
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        disabled={safePage >= pageCount}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    )
}
