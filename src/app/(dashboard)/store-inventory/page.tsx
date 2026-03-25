import Link from 'next/link'
import SectionTitle from '@/components/ui/section-title'
import { Card, CardBody } from '@/components/ui/card'

const links = [
  { label: 'Products', href: '/store-inventory/products' },
  { label: 'Create Product', href: '/store-inventory/product-create' },
  { label: 'Purchases', href: '/store-inventory/purchases' },
  { label: 'Create Purchase', href: '/store-inventory/purchase-create' },
  { label: 'Adjustments', href: '/store-inventory/adjustments' },
  { label: 'Create Adjustment', href: '/store-inventory/adjustment-create' },
  { label: 'Inventories', href: '/store-inventory/inventories' },
  { label: 'Demand Send', href: '/store-inventory/demands-send' },
  { label: 'Demand Response', href: '/store-inventory/demands-response' },
  { label: 'Stores', href: '/store-inventory/stores' },
  { label: 'Vendors', href: '/store-inventory/vendors' },
  { label: 'Weapons', href: '/store-inventory/weapons' },
  { label: 'Brands', href: '/store-inventory/brands' },
  { label: 'Units', href: '/store-inventory/units' },
  { label: 'Categories', href: '/store-inventory/categories' },
  { label: 'Conditions', href: '/store-inventory/conditions' },
  { label: 'Employee Assignments', href: '/store-inventory/employee-assignments' },
  { label: 'Inventory Assignments', href: '/store-inventory/inventory-assignments' },
  { label: 'Client Assignments', href: '/store-inventory/client-assignments' },
  { label: 'Audits', href: '/store-inventory/audits' },
]

export default function StoreInventoryDashboardPage() {
  return (
    <div className="space-y-6">
      <SectionTitle title="Store Inventory" subtitle="Inventory V2 namespace (add-first migration foundation)." />

      <Card>
        <CardBody>
          <p className="mb-3 text-sm font-semibold text-[var(--text)]">Store Inventory Navigation</p>
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
