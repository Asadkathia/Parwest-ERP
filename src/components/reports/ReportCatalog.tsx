"use client"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card"
import { Input } from "@/components/shadcn/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"

interface CatalogItem {
  key: string
  title: string
  description: string
  category: string
  pinned: boolean
}

const CATS = [
  "all",
  "guards",
  "clients",
  "deployments",
  "financial",
  "inventory",
  "other",
] as const

type Cat = (typeof CATS)[number]

export function ReportCatalog() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [q, setQ] = useState("")
  const [cat, setCat] = useState<Cat>("all")

  useEffect(() => {
    let mounted = true
    fetch("/api/reports/catalog")
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setItems(d.data ?? [])
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items
      .filter((i) => (cat === "all" ? true : i.category === cat))
      .filter((i) =>
        !term
          ? true
          : i.title.toLowerCase().includes(term) ||
            i.description.toLowerCase().includes(term)
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title))
  }, [items, q, cat])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          placeholder="Search reports"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={cat} onValueChange={(v) => setCat(v as Cat)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATS.map((c) => (
              <SelectItem key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((i) => (
          <Link key={i.key} href={`/reports/catalog/${i.key}`} className="group">
            <Card className="h-full transition-colors group-hover:border-foreground/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  {i.title}
                  {i.pinned ? (
                    <span className="ml-2 text-xs uppercase text-primary">Pinned</span>
                  ) : null}
                </CardTitle>
                <CardDescription className="text-xs uppercase">
                  {i.category}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{i.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {visible.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No reports match.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
