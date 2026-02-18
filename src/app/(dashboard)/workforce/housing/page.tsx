import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody } from "@/components/ui/card"

const housingTabs = [
  { title: "Residences", href: "/guards/residences", description: "Manage residences and availability by supervisor and owner." },
  { title: "Assign Residence", href: "/guards/assign-residence", description: "Assign active guards to residences with assignment dates." },
]

export default async function WorkforceHousingPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <SectionTitle title="Workforce Housing" subtitle="Residences and residence assignment flows." />
      <div className="grid gap-4 md:grid-cols-2">
        {housingTabs.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition hover:shadow-[var(--shadow-md)]">
              <CardBody className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text)]">{item.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{item.description}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
