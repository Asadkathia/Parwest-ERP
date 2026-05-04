"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card"

interface CatalogItem {
  key: string
  title: string
  description: string
  category: string
  pinned: boolean
}

export function PinnedReports() {
  const [items, setItems] = useState<CatalogItem[]>([])

  useEffect(() => {
    let mounted = true
    fetch("/api/reports/catalog")
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return
        const all = (d.data ?? []) as CatalogItem[]
        setItems(all.filter((i) => i.pinned))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  if (items.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Pinned reports</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.key}>
              <Link
                className="underline-offset-2 hover:underline"
                href={`/reports/catalog/${i.key}`}
              >
                {i.title}
              </Link>
              <span className="ml-2 text-xs uppercase text-muted-foreground">
                {i.category}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
