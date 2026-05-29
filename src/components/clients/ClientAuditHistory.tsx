"use client"

import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table"
import { Badge } from "@/components/shadcn/badge"
import { Skeleton } from "@/components/shadcn/skeleton"

type AuditEntry = {
  id: string
  event: string
  module: string
  description: string | null
  createdAt: string
  userName: string
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ClientAuditHistory({ clientId }: { clientId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/clients/${clientId}/audit`)
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.message || "Failed to load change history.")
        }
        const data = (await res.json()) as AuditEntry[]
        if (!cancelled) setEntries(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load change history.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        No recorded changes yet.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-48">Date</TableHead>
            <TableHead className="w-44">Event</TableHead>
            <TableHead className="w-40">User</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                {formatTimestamp(entry.createdAt)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-[11px]">
                  {entry.event}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{entry.userName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {entry.description || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
