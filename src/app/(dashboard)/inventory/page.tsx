import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody } from "@/components/ui/card"

export default function InventoryDashboardPage() {
  const cards = [
    { type: "WEAPON", total: 120, issued: 80, remaining: 40 },
    { type: "UNIFORM", total: 340, issued: 210, remaining: 130 },
    { type: "EQUIPMENT", total: 210, issued: 122, remaining: 88 },
    { type: "AMMUNITION", total: 500, issued: 260, remaining: 240 },
  ]

  const links = [
    { label: "Search", href: "/inventory/search" },
    { label: "Stock In", href: "/inventory/stock-in" },
    { label: "Assign Item", href: "/inventory/assign-item" },
    { label: "Demand", href: "/inventory/demand" },
    { label: "Categories", href: "/inventory/categories" },
    { label: "Vendors", href: "/inventory/vendors" },
    { label: "Conditions", href: "/inventory/conditions" },
    { label: "Condemned Items", href: "/inventory/condemned" },
  ]

  return (
    <div className="space-y-6">
      <SectionTitle title="Dashboard" subtitle="Inventory dashboard" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.type}>
            <CardBody className="space-y-3">
              <p className="text-sm font-semibold text-[var(--text)]">{card.type}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Total Available</p>
                  <p className="text-lg font-semibold">{card.total}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Issued</p>
                  <p className="text-lg font-semibold">{card.issued}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Remaining</p>
                  <p className="text-lg font-semibold">{card.remaining}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <p className="mb-3 text-sm font-semibold text-[var(--text)]">Inventory Navigation</p>
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="ui-btn ui-btn-secondary">
                {link.label}
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
