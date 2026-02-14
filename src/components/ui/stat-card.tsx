import { Card, CardBody } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  value: string | number
  icon?: React.ReactNode
  tone?: "brand" | "success" | "warning" | "danger"
}

export default function StatCard({ label, value, icon, tone = "brand" }: Props) {
  return (
    <Card className="transition-all hover:-translate-y-0.5">
      <CardBody className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">{value}</p>
        </div>
        {icon ? (
          <div
            className={cn(
              "h-11 w-11 rounded-full flex items-center justify-center",
              tone === "brand" && "bg-blue-100 text-blue-700",
              tone === "success" && "bg-green-100 text-green-700",
              tone === "warning" && "bg-amber-100 text-amber-700",
              tone === "danger" && "bg-red-100 text-red-700"
            )}
          >
            {icon}
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}
