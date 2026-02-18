import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody } from "@/components/ui/card"

const quickActions = [
  { title: "Search Inventory", href: "/inventory/search", description: "Find items by category, vendor, status, and serial references." },
  { title: "Stock In", href: "/inventory/stock-in", description: "Register newly purchased inventory items and quantities." },
  { title: "Assign Item", href: "/inventory/assign-item", description: "Checkout items to guard or client with assignment history." },
  { title: "Demand", href: "/inventory/demand", description: "Submit and track inventory demand from regional offices." },
]

const setupActions = [
  { title: "Categories", href: "/inventory/categories" },
  { title: "Vendors", href: "/inventory/vendors" },
  { title: "Conditions", href: "/inventory/conditions" },
  { title: "Condemned Items", href: "/inventory/condemned" },
]

export default function InventoryDashboardPage() {
  return (
    <div className="space-y-6">
      <SectionTitle title="Inventory" subtitle="Unified inventory landing for dashboard and search workflows." />

      <div className="grid gap-4 md:grid-cols-2">
        {quickActions.map((item) => (
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

      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm font-semibold text-[var(--text)]">Setup</p>
          <div className="flex flex-wrap gap-2">
            {setupActions.map((item) => (
              <Link key={item.href} href={item.href} className="ui-btn ui-btn-secondary">
                {item.title}
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
