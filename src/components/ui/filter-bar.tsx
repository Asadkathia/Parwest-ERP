import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/shadcn/card"

/**
 * DEPRECATED — kept as a compatibility shim during the v1.1 migration.
 * New code should use shadcn `Card` + `CardContent` directly.
 * Importers will migrate incrementally; deleted at zero importers.
 */

interface Props {
  children: React.ReactNode
  className?: string
}

export default function FilterBar({ children, className }: Props) {
  return (
    <Card>
      <CardContent className={cn("p-5", className)}>{children}</CardContent>
    </Card>
  )
}
