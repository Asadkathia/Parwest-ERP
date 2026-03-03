import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody } from "@/components/ui/card"

const links = [
  { title: "Regions", href: "/settings/regions" },
  { title: "Regional Offices", href: "/settings/offices" },
  { title: "Guard Documents", href: "/settings/guard-pledgeable-documents" },
  { title: "User Types", href: "/settings/user-types" },
  { title: "Guard Bank Names", href: "/settings/guard-bank-names" },
  { title: "Fingerprint Device", href: "/settings/fingerprint-device" },
  { title: "Workflow Rules", href: "/settings/workflow-rules" },
  { title: "System Settings", href: "/settings/system" },
]

export default function SettingsOverviewPage() {
  return (
    <div className="space-y-6">
      <SectionTitle title="Settings" subtitle="Master settings routes and setup workflows." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition hover:shadow-[var(--shadow-md)]">
              <CardBody>
                <p className="text-sm font-semibold text-[var(--text)]">{item.title}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
