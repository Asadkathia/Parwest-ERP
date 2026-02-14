import { cn } from "@/lib/utils"

type Props = {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export default function SectionTitle({ title, subtitle, action, className }: Props) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text)]">{title}</h2>
        {subtitle ? <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  )
}
