import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody } from "@/components/ui/card"

const billingTabs = [
  { title: "Pricing", href: "/clients/pricing", description: "Contract rates and pricing profiles for clients and branches." },
  { title: "Invoice Prerequisites", href: "/clients/invoice-prerequisites", description: "Default rates, province/city, and guard type setup." },
  { title: "Invoiced Billings", href: "/clients/invoiced-billings", description: "Track invoiced, pending, and error invoice records." },
  { title: "Invoicing", href: "/clients/invoicing", description: "Generate branch-wise and client-wise invoice drafts." },
]

export default async function ClientContractsBillingPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <SectionTitle title="Client Contracts & Billing" subtitle="Pricing, prerequisites, invoiced billings, and invoicing workspace." />
      <div className="grid gap-4 md:grid-cols-2">
        {billingTabs.map((item) => (
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
