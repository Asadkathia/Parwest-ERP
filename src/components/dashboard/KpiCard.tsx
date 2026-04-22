import Link from "next/link"
import { Card, CardBody } from "@/components/ui/card"
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
      <CardBody className="space-y-3">
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
      </CardBody>
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
        flat && "bg-gray-100 text-gray-600",
        up && !flat && "bg-emerald-100 text-emerald-700",
        !up && !flat && "bg-red-100 text-red-700"
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
    tone === "danger" ? "#dc2626" : tone === "warning" ? "#d97706" : tone === "success" ? "#059669" : "#2563eb"
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
