import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
    title: 'Inventory',
    description: 'Manage inventory and assets',
};

export default function InventoryPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Inventory"
                description="Manage inventory, uniforms, and equipment"
                breadcrumbs={[{ label: 'Inventory' }]}
            />

            <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                        Inventory module coming soon. This will include asset management, issuance, and tracking.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
