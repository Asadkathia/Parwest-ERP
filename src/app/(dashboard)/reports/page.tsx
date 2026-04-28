"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import { reportLinks } from "@/lib/parity/screenConfigs"

const REPORT_TILES: Array<{
  href: string
  title: string
  description: string
}> = [
  {
    href: "/reports/scheduled",
    title: "Scheduled Reports",
    description: "Manage recurring report deliveries to email recipients.",
  },
  {
    href: "/reports/guard-deployment",
    title: "Guard Deployment",
    description: "Active deployments grouped by region, client, and shift.",
  },
  {
    href: "/reports/day-night-duty",
    title: "Day & Night Duty",
    description: "Compare day vs. night guard coverage over a period.",
  },
  {
    href: "/reports/client-enrolled",
    title: "Client Enrolled",
    description: "New clients enrolled in the selected window.",
  },
  {
    href: "/reports/client-summary",
    title: "Client Summary",
    description: "Per-client deployments, branches, and invoicing overview.",
  },
  {
    href: "/reports/inventory-store-summary",
    title: "Inventory Summary",
    description: "Store balances and valuation from the v2 inventory dataset.",
  },
  {
    href: "/reports/generated",
    title: "Generated Reports",
    description: "Library of previously generated and downloadable reports.",
  },
]

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "operational", label: "Operational" },
  { value: "client", label: "Client" },
  { value: "inventory", label: "Inventory" },
  { value: "scheduled", label: "Scheduled" },
]

const RANGE_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "ytd", label: "Year to date" },
]

export default function ReportsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Preserve existing URL contract — read filter values from query string.
  const range = searchParams.get("range") ?? "any"
  const type = searchParams.get("type") ?? "all"
  const search = searchParams.get("q") ?? ""

  const updateParam = useCallback(
    (key: string, value: string, fallback: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!value || value === fallback) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `/reports?${qs}` : "/reports", { scroll: false })
    },
    [router, searchParams]
  )

  const visibleTiles = useMemo(() => {
    const term = search.trim().toLowerCase()
    return REPORT_TILES.filter((tile) => {
      if (type !== "all") {
        const matchesType =
          (type === "client" && tile.href.includes("client")) ||
          (type === "inventory" && tile.href.includes("inventory")) ||
          (type === "scheduled" && tile.href.includes("scheduled")) ||
          (type === "operational" &&
            (tile.href.includes("guard") || tile.href.includes("day-night")))
        if (!matchesType) return false
      }
      if (!term) return true
      return (
        tile.title.toLowerCase().includes(term) ||
        tile.description.toLowerCase().includes(term)
      )
    })
  }, [search, type])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Frontend route hub for all documented report screens.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 justify-end" aria-label="Report quick links">
          {reportLinks.slice(1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Filters</CardTitle>
          <CardDescription>Narrow the available reports below.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="reports-range">Date range</Label>
              <Select
                value={range}
                onValueChange={(value) => updateParam("range", value, "any")}
              >
                <SelectTrigger id="reports-range">
                  <SelectValue placeholder="Any time" />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reports-type">Report type</Label>
              <Select
                value={type}
                onValueChange={(value) => updateParam("type", value, "all")}
              >
                <SelectTrigger id="reports-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reports-search">Search</Label>
              <Input
                id="reports-search"
                placeholder="Find a report"
                defaultValue={search}
                onBlur={(event) => updateParam("q", event.target.value, "")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    updateParam("q", (event.target as HTMLInputElement).value, "")
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTiles.length === 0 ? (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No reports match the current filters.
            </CardContent>
          </Card>
        ) : (
          visibleTiles.map((tile) => (
            <Link key={tile.href} href={tile.href} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/30 group-hover:bg-accent/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{tile.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{tile.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
