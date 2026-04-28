import Link from "next/link"
import { AlertCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import { Button } from "@/components/shadcn/button"

/**
 * Legacy inventory landing page.
 *
 * Phase 6A: replaced the auto-redirect with a deprecation banner so the
 * legacy module is visibly read-only. Per `Parwest /legacy-vs-v2.html`,
 * new work belongs in the v2 `store-inventory` module.
 */
export default function LegacyInventoryDashboardPage() {
  return (
    <div className="space-y-6">
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Legacy module — read-only</AlertTitle>
        <AlertDescription>
          This is the legacy inventory module. New work belongs in{" "}
          <Link href="/store-inventory" className="underline">
            store inventory
          </Link>
          . No new features will be added here.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory (legacy)</h1>
          <p className="text-sm text-muted-foreground">
            Continue to the active store-inventory v2 module to manage products,
            purchases, demands, and stock balances.
          </p>
        </div>
        <Button asChild>
          <Link href="/store-inventory">Go to store inventory</Link>
        </Button>
      </div>
    </div>
  )
}
