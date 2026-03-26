import PurchaseDetailsPage from "@/components/store-inventory-v2/PurchaseDetailsPage"

export default async function StoreInventoryPurchaseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PurchaseDetailsPage purchaseId={id} />
}

