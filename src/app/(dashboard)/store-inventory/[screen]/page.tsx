import { notFound, redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hasAction } from '@/lib/api/permissions'
import { deriveRegionalScope } from '@/lib/access/scope'
import ConfiguredInteractiveScreen from '@/components/parity/ConfiguredInteractiveScreen'
import MasterManager from '@/components/store-inventory-v2/MasterManager'
import ProductsManager from '@/components/store-inventory-v2/ProductsManager'
import PurchasesManager from '@/components/store-inventory-v2/PurchasesManager'
import AdjustmentsManager from '@/components/store-inventory-v2/AdjustmentsManager'
import DemandsManager from '@/components/store-inventory-v2/DemandsManager'
import AssignmentsManager from '@/components/store-inventory-v2/AssignmentsManager'
import InventoriesManager from '@/components/store-inventory-v2/InventoriesManager'
import AuditManager from '@/components/store-inventory-v2/AuditManager'
import ProductUniqueItemsManager from '@/components/store-inventory-v2/ProductUniqueItemsManager'
import LicensesManager from '@/components/store-inventory-v2/LicensesManager'
import RegionFilterCard from '@/components/access/RegionFilterCard'
import type { Session } from 'next-auth'
import { storeInventoryLinks, storeInventoryScreens } from '@/lib/inventory/store-screen-configs'

function withRegionPicker(session: Session, body: ReactNode) {
  return (
    <div className="space-y-6">
      <RegionFilterCard session={session} />
      {body}
    </div>
  )
}

export default async function StoreInventoryScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params

  const session = await auth()
  if (!session) redirect("/login")

  // Gate create/adjustment create screens on CREATE action.
  const createScreens = new Set([
    'product-create', 'purchase-create', 'weapon-purchase-create',
    'adjustment-create', 'weapon-adjustment-create',
  ])
  if (createScreens.has(screen) && !hasAction(session, "INVENTORY", "CREATE")) {
    redirect("/store-inventory")
  }
  // Demand / requisition screens.
  if ((screen === 'demands-send' || screen === 'demands-response') &&
      !hasAction(session, "INVENTORY", "REQUISITIONS")) {
    redirect("/store-inventory")
  }

  // Resolve region picker props for list-style screens. Managers embed the
  // picker into the first cell of their advanced filter grid.
  const scope = deriveRegionalScope(session)
  const allRegions = await prisma.region
    .findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
    .catch(() => [] as { id: string; name: string }[])
  const pickerRegions = scope?.regionId
    ? allRegions.filter((r) => r.id === scope.regionId)
    : allRegions
  const locked = Boolean(scope?.regionId)
  const rp = { regions: pickerRegions, locked }

  if (screen === 'stores') {
    return (
      <MasterManager
        resource="stores"
        title="Stores"
        subtitle="Manage store/warehouse records for inventory v2."
        supportsStoreFields
        {...rp}
      />
    )
  }
  if (screen === 'vendors') return <MasterManager resource="vendors" title="Vendors" subtitle="Manage vendor records." supportsContact supportsVendorFields {...rp} />
  if (screen === 'categories') return <MasterManager resource="categories" title="Categories" subtitle="Manage product categories." supportsCategoryFields {...rp} />
  if (screen === 'brands') return <MasterManager resource="brands" title="Brands" subtitle="Manage product brands." {...rp} />
  if (screen === 'units') return <MasterManager resource="units" title="Units" subtitle="Manage product units." supportsUnitShortCode {...rp} />
  if (screen === 'statuses') return <MasterManager resource="statuses" title="Statuses" subtitle="Manage product statuses." supportsStatusCategory {...rp} />
  if (screen === 'conditions') return <MasterManager resource="conditions" title="Conditions" subtitle="Manage product conditions." supportsDescription {...rp} />
  if (screen === 'weapons') redirect('/store-inventory/weapon-types')
  if (screen === 'weapon-types') return <MasterManager resource="weapon-types" title="Weapon Types" subtitle="Manage weapon type taxonomy." {...rp} />
  if (screen === 'calibres') return <MasterManager resource="calibres" title="Calibres" subtitle="Manage calibre taxonomy." {...rp} />
  if (screen === 'licenses') return <LicensesManager {...rp} />
  if (screen === 'variations') return <MasterManager resource="variations" title="Variations" subtitle="Manage product variations." {...rp} />
  if (screen === 'repairings') return <MasterManager resource="repairings" title="Repairings" subtitle="Manage repairing statuses/types." {...rp} />
  if (screen === 'products') return <ProductsManager {...rp} />
  if (screen === 'product-create') return withRegionPicker(session, <ProductsManager createMode />)
  if (screen === 'purchases') return <PurchasesManager {...rp} />
  if (screen === 'purchase-create') return withRegionPicker(session, <PurchasesManager createMode />)
  if (screen === 'weapon-purchases') return <PurchasesManager productScope="WEAPON" {...rp} />
  if (screen === 'weapon-purchase-create') return withRegionPicker(session, <PurchasesManager createMode productScope="WEAPON" />)
  if (screen === 'adjustments') return <AdjustmentsManager {...rp} />
  if (screen === 'adjustment-create') return withRegionPicker(session, <AdjustmentsManager createMode />)
  if (screen === 'weapon-adjustments') return <AdjustmentsManager productScope="WEAPON_AMMO" {...rp} />
  if (screen === 'weapon-adjustment-create') return withRegionPicker(session, <AdjustmentsManager createMode productScope="WEAPON_AMMO" />)
  if (screen === 'demands-send') return <DemandsManager {...rp} />
  if (screen === 'demands-response') return <DemandsManager responseMode {...rp} />
  if (screen === 'inventory-assignments') return <AssignmentsManager assignmentType="GUARD" {...rp} />
  if (screen === 'employee-assignments') return <AssignmentsManager assignmentType="EMPLOYEE" {...rp} />
  if (screen === 'client-assignments') return <AssignmentsManager assignmentType="CLIENT" {...rp} />
  if (screen === 'weapon-client-assignments') return <AssignmentsManager assignmentType="CLIENT" productScope="WEAPON" {...rp} />
  if (screen === 'inventories') return <InventoriesManager {...rp} />
  if (screen === 'weapon-inventories') return <InventoriesManager categoryScope="WEAPON" {...rp} />
  if (screen === 'ammo-inventories') return <InventoriesManager categoryScope="AMMO" {...rp} />
  if (screen === 'audits') return <AuditManager {...rp} />
  if (screen === 'roles') redirect('/users/roles')
  if (screen === 'users') redirect('/users')
  if (screen === 'product-unique-items') return <ProductUniqueItemsManager {...rp} />

  const config = storeInventoryScreens[screen]
  if (!config) notFound()

  return withRegionPicker(session, <ConfiguredInteractiveScreen config={config} links={storeInventoryLinks} />)
}
