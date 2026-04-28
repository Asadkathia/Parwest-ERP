import * as React from "react"

import { Card, CardContent } from "@/components/shadcn/card"
import { cn } from "@/lib/utils"

type Tone = "brand" | "success" | "warning" | "danger"

type Props = {
  label: string
  value: string | number
  icon?: React.ReactNode
  tone?: Tone
}

function toneToBadge(tone: Tone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
    case "warning":
      return "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
    case "danger":
      return "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300"
    case "brand":
    default:
      return "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
  }
}

export default function ParwestStatCard({ label, value, icon, tone = "brand" }: Props) {
  return (
    <Card className="transition-all hover:-translate-y-0.5">
      <CardContent className="flex items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        </div>
        {icon ? (
          <div
            className={cn(
              "h-11 w-11 rounded-full flex items-center justify-center",
              toneToBadge(tone)
            )}
          >
            {icon}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
