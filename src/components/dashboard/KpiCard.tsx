import Link from "next/link"
import { Card, CardContent } from "@/components/shadcn/card"
import { cn } from "@/lib/utils"
import { TrendingDown, TrendingUp, Minus } from "lucide-react"

type Props = {
  label: string
  value: string | number
  deltaToday?: number
  sparkline?: number[]
  tone?: "brand" | "success" | "warning" | "danger"
  href?: string
  footer?: React.ReactNode
}

export default function KpiCard({ label, value, deltaToday, sparkline, tone = "brand", href, footer }: Props) {
  const content = (
    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
          {typeof deltaToday === "number" && deltaToday !== 0 ? <DeltaChip value={deltaToday} /> : null}
        </div>
        <p
          className={cn(
            "text-2xl font-bold",
            tone === "danger" && "text-red-600",
            tone === "warning" && "text-amber-600",
            tone === "success" && "text-emerald-600",
            tone === "brand" && "text-[var(--text)]"
          )}
        >
          {value}
        </p>
        {sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} tone={tone} /> : null}
        {footer ? <div className="text-xs text-[var(--text-muted)]">{footer}</div> : null}
      </CardContent>
    </Card>
  )
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  )
}

function DeltaChip({ value }: { value: number }) {
  const up = value > 0
  const flat = value === 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        flat && "bg-muted text-muted-foreground",
        up && !flat && "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
        !up && !flat && "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300"
      )}
    >
      {flat ? <Minus className="h-3 w-3" /> : up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {value} today
    </span>
  )
}

function Sparkline({ values, tone }: { values: number[]; tone: Props["tone"] }) {
  const max = Math.max(1, ...values)
  const w = 100
  const h = 28
  const step = values.length > 1 ? w / (values.length - 1) : 0
  const points = values.map((v, i) => `${(i * step).toFixed(2)},${(h - (v / max) * h).toFixed(2)}`).join(" ")
  const stroke =
    tone === "danger" ? "var(--danger-600)" : tone === "warning" ? "var(--warning-600)" : tone === "success" ? "var(--success-600)" : "var(--brand-600)"
  const fill =
    tone === "danger"
      ? "rgba(220,38,38,0.08)"
      : tone === "warning"
      ? "rgba(217,119,6,0.08)"
      : tone === "success"
      ? "rgba(5,150,105,0.08)"
      : "rgba(37,99,235,0.08)"
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none">
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={fill} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
