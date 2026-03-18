import { notFound } from 'next/navigation'
import ConfiguredInteractiveScreen from '@/components/parity/ConfiguredInteractiveScreen'
import MasterManager from '@/components/store-inventory-v2/MasterManager'
import ProductsManager from '@/components/store-inventory-v2/ProductsManager'
import PurchasesManager from '@/components/store-inventory-v2/PurchasesManager'
import AdjustmentsManager from '@/components/store-inventory-v2/AdjustmentsManager'
import DemandsManager from '@/components/store-inventory-v2/DemandsManager'
import AssignmentsManager from '@/components/store-inventory-v2/AssignmentsManager'
import InventoriesManager from '@/components/store-inventory-v2/InventoriesManager'
import AuditManager from '@/components/store-inventory-v2/AuditManager'
import RolesManager from '@/components/store-inventory-v2/RolesManager'
import UsersManager from '@/components/store-inventory-v2/UsersManager'
import ProductUniqueItemsManager from '@/components/store-inventory-v2/ProductUniqueItemsManager'
import { storeInventoryLinks, storeInventoryScreens } from '@/lib/inventory/store-screen-configs'

export default async function StoreInventoryScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params

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
  if (screen === 'vendors') return <MasterManager resource="vendors" title="Vendors" subtitle="Manage vendor records." supportsContact />
  if (screen === 'categories') return <MasterManager resource="categories" title="Categories" subtitle="Manage product categories." />
  if (screen === 'brands') return <MasterManager resource="brands" title="Brands" subtitle="Manage product brands." />
  if (screen === 'units') return <MasterManager resource="units" title="Units" subtitle="Manage product units." supportsUnitShortCode />
  if (screen === 'statuses') return <MasterManager resource="statuses" title="Statuses" subtitle="Manage product statuses." />
  if (screen === 'conditions') return <MasterManager resource="conditions" title="Conditions" subtitle="Manage product conditions." supportsDescription />
  if (screen === 'weapons') return <MasterManager resource="weapon-types" title="Weapons" subtitle="Manage weapon definitions." />
  if (screen === 'weapon-types') return <MasterManager resource="weapon-types" title="Weapon Types" subtitle="Manage weapon type taxonomy." />
  if (screen === 'calibres') return <MasterManager resource="calibres" title="Calibres" subtitle="Manage calibre taxonomy." />
  if (screen === 'licenses') return <MasterManager resource="license-types" title="Licenses" subtitle="Manage license type taxonomy." />
  if (screen === 'variations') return <MasterManager resource="variations" title="Variations" subtitle="Manage product variations." />
  if (screen === 'repairings') return <MasterManager resource="repairings" title="Repairings" subtitle="Manage repairing statuses/types." />
  if (screen === 'products') return <ProductsManager />
  if (screen === 'product-create') return <ProductsManager createMode />
  if (screen === 'purchases') return <PurchasesManager />
  if (screen === 'purchase-create') return <PurchasesManager createMode />
  if (screen === 'adjustments') return <AdjustmentsManager />
  if (screen === 'adjustment-create') return <AdjustmentsManager createMode />
  if (screen === 'demands-send') return <DemandsManager />
  if (screen === 'demands-response') return <DemandsManager responseMode />
  if (screen === 'inventory-assignments') return <AssignmentsManager />
  if (screen === 'employee-assignments') return <AssignmentsManager employeeMode />
  if (screen === 'inventories') return <InventoriesManager />
  if (screen === 'audits') return <AuditManager />
  if (screen === 'roles') return <RolesManager />
  if (screen === 'users') return <UsersManager />
  if (screen === 'product-unique-items') return <ProductUniqueItemsManager />

  const config = storeInventoryScreens[screen]
  if (!config) notFound()

  return <ConfiguredInteractiveScreen config={config} links={storeInventoryLinks} />
}
