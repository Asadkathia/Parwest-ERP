import { cn } from "@/lib/utils"
import { Card, CardBody } from "@/components/ui/card"

type Props = {
  children: React.ReactNode
  className?: string
}

export default function FilterBar({ children, className }: Props) {
  return (
    <Card className={cn("bg-[var(--surface)]", className)}>
      <CardBody>{children}</CardBody>
    </Card>
  )
}
