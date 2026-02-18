import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody } from "@/components/ui/card"

const complianceTabs = [
  { title: "Black Listed", href: "/guards/blacklist", description: "Manage blocked guards and blacklist records." },
  { title: "Inactive", href: "/guards/inactive", description: "Review deactivated guards and re-activation actions." },
  { title: "Emergency", href: "/guards/emergency", description: "Temporary emergency guard pool with missing docs." },
  { title: "Docs Checklist", href: "/guards/docs-checklist", description: "Print submitted documents by checklist selection." },
]

export default async function WorkforceCompliancePage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <SectionTitle title="Workforce Compliance" subtitle="Blacklist, inactive, emergency, and documents checklist workflows." />
      <div className="grid gap-4 md:grid-cols-2">
        {complianceTabs.map((item) => (
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
