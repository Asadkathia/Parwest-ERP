import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody } from "@/components/ui/card"

const settingTabs = [
  { title: "Regions", href: "/settings/regions", description: "Manage region master records and office hierarchy roots." },
  { title: "Regional Offices", href: "/settings/offices", description: "Maintain regional office details and series codes." },
  { title: "Guard Documents", href: "/settings/guard-pledgeable-documents", description: "Define guard pledgeable document types." },
  { title: "User Types", href: "/settings/user-types", description: "Maintain user role labels and access categories." },
  { title: "Guard Bank Names", href: "/settings/guard-bank-names", description: "Configure bank names available in guard forms." },
  { title: "System Settings", href: "/settings/system", description: "General app-level settings and defaults." },
]

export default async function SystemSettingsHubPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <SectionTitle title="System Settings" subtitle="Master settings managed under the System module." />
      <div className="grid gap-4 md:grid-cols-2">
        {settingTabs.map((item) => (
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
