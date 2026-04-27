import Link from 'next/link'
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import SectionTitle from '@/components/ui/section-title'
import { Card, CardBody } from '@/components/ui/card'
import RegionFilterCard from '@/components/access/RegionFilterCard'

type InventoryAction = "VIEW" | "CREATE" | "REQUISITIONS"

const links: { label: string; href: string; requiredAction: InventoryAction }[] = [
  { label: 'Products', href: '/store-inventory/products', requiredAction: 'VIEW' },
  { label: 'Create Product', href: '/store-inventory/product-create', requiredAction: 'CREATE' },
  { label: 'Purchases', href: '/store-inventory/purchases', requiredAction: 'VIEW' },
  { label: 'Create Purchase', href: '/store-inventory/purchase-create', requiredAction: 'CREATE' },
  { label: 'Adjustments', href: '/store-inventory/adjustments', requiredAction: 'VIEW' },
  { label: 'Create Adjustment', href: '/store-inventory/adjustment-create', requiredAction: 'CREATE' },
  { label: 'Inventories', href: '/store-inventory/inventories', requiredAction: 'VIEW' },
  { label: 'Demand Send', href: '/store-inventory/demands-send', requiredAction: 'REQUISITIONS' },
  { label: 'Demand Response', href: '/store-inventory/demands-response', requiredAction: 'REQUISITIONS' },
  { label: 'Stores', href: '/store-inventory/stores', requiredAction: 'VIEW' },
  { label: 'Vendors', href: '/store-inventory/vendors', requiredAction: 'VIEW' },
  { label: 'Weapon Types', href: '/store-inventory/weapon-types', requiredAction: 'VIEW' },
  { label: 'Brands', href: '/store-inventory/brands', requiredAction: 'VIEW' },
  { label: 'Units', href: '/store-inventory/units', requiredAction: 'VIEW' },
  { label: 'Categories', href: '/store-inventory/categories', requiredAction: 'VIEW' },
  { label: 'Conditions', href: '/store-inventory/conditions', requiredAction: 'VIEW' },
  { label: 'Employee Assignments', href: '/store-inventory/employee-assignments', requiredAction: 'VIEW' },
  { label: 'Inventory Assignments', href: '/store-inventory/inventory-assignments', requiredAction: 'VIEW' },
  { label: 'Client Assignments', href: '/store-inventory/client-assignments', requiredAction: 'VIEW' },
  { label: 'Audits', href: '/store-inventory/audits', requiredAction: 'VIEW' },
]

export default async function StoreInventoryDashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const visibleLinks = links.filter((l) => hasAction(session, "INVENTORY", l.requiredAction))

  return (
    <div className="space-y-6">
      <SectionTitle title="Store Inventory" subtitle="Inventory V2 namespace (add-first migration foundation)." />

      <RegionFilterCard session={session} />

      <Card>
        <CardBody>
          <p className="mb-3 text-sm font-semibold text-[var(--text)]">Store Inventory Navigation</p>
          <div className="flex flex-wrap gap-2">
            {visibleLinks.map((link) => (
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
