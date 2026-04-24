import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasAction } from '@/lib/api/permissions'
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
import { storeInventoryLinks, storeInventoryScreens } from '@/lib/inventory/store-screen-configs'

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

  if (screen === 'stores') {
    return (
      <MasterManager
        resource="stores"
        title="Stores"
        subtitle="Manage store/warehouse records for inventory v2."
        supportsStoreFields
      />
    )
  }
  if (screen === 'vendors') return <MasterManager resource="vendors" title="Vendors" subtitle="Manage vendor records." supportsContact supportsVendorFields />
  if (screen === 'categories') return <MasterManager resource="categories" title="Categories" subtitle="Manage product categories." supportsCategoryFields />
  if (screen === 'brands') return <MasterManager resource="brands" title="Brands" subtitle="Manage product brands." />
  if (screen === 'units') return <MasterManager resource="units" title="Units" subtitle="Manage product units." supportsUnitShortCode />
  if (screen === 'statuses') return <MasterManager resource="statuses" title="Statuses" subtitle="Manage product statuses." supportsStatusCategory />
  if (screen === 'conditions') return <MasterManager resource="conditions" title="Conditions" subtitle="Manage product conditions." supportsDescription />
  if (screen === 'weapons') redirect('/store-inventory/weapon-types')
  if (screen === 'weapon-types') return <MasterManager resource="weapon-types" title="Weapon Types" subtitle="Manage weapon type taxonomy." />
  if (screen === 'calibres') return <MasterManager resource="calibres" title="Calibres" subtitle="Manage calibre taxonomy." />
  if (screen === 'licenses') return <LicensesManager />
  if (screen === 'variations') return <MasterManager resource="variations" title="Variations" subtitle="Manage product variations." />
  if (screen === 'repairings') return <MasterManager resource="repairings" title="Repairings" subtitle="Manage repairing statuses/types." />
  if (screen === 'products') return <ProductsManager />
  if (screen === 'product-create') return <ProductsManager createMode />
  if (screen === 'purchases') return <PurchasesManager />
  if (screen === 'purchase-create') return <PurchasesManager createMode />
  if (screen === 'weapon-purchases') return <PurchasesManager productScope="WEAPON" />
  if (screen === 'weapon-purchase-create') return <PurchasesManager createMode productScope="WEAPON" />
  if (screen === 'adjustments') return <AdjustmentsManager />
  if (screen === 'adjustment-create') return <AdjustmentsManager createMode />
  if (screen === 'weapon-adjustments') return <AdjustmentsManager productScope="WEAPON_AMMO" />
  if (screen === 'weapon-adjustment-create') return <AdjustmentsManager createMode productScope="WEAPON_AMMO" />
  if (screen === 'demands-send') return <DemandsManager />
  if (screen === 'demands-response') return <DemandsManager responseMode />
  if (screen === 'inventory-assignments') return <AssignmentsManager assignmentType="GUARD" />
  if (screen === 'employee-assignments') return <AssignmentsManager assignmentType="EMPLOYEE" />
  if (screen === 'client-assignments') return <AssignmentsManager assignmentType="CLIENT" />
  if (screen === 'weapon-client-assignments') return <AssignmentsManager assignmentType="CLIENT" productScope="WEAPON" />
  if (screen === 'inventories') return <InventoriesManager />
  if (screen === 'weapon-inventories') return <InventoriesManager categoryScope="WEAPON" />
  if (screen === 'ammo-inventories') return <InventoriesManager categoryScope="AMMO" />
  if (screen === 'audits') return <AuditManager />
  if (screen === 'roles') redirect('/users/roles')
  if (screen === 'users') redirect('/users')
  if (screen === 'product-unique-items') return <ProductUniqueItemsManager />

  const config = storeInventoryScreens[screen]
  if (!config) notFound()

  return <ConfiguredInteractiveScreen config={config} links={storeInventoryLinks} />
}
