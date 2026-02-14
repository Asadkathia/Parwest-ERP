import { Card, CardBody } from "@/components/ui/card"

type Props = {
  title: string
  description?: string
}

export default function EmptyState({ title, description }: Props) {
  return (
    <Card>
      <CardBody className="py-12 text-center">
        <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
        {description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p> : null}
      </CardBody>
    </Card>
  )
}
