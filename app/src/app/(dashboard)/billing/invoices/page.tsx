import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Invoices',
    description: 'Manage billing and invoices',
};

export default function InvoicesPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Invoices"
                description="Manage billing and invoice generation"
                breadcrumbs={[{ label: 'Billing' }, { label: 'Invoices' }]}
                actions={
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Generate Invoice
                    </Button>
                }
            />

            <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                        Billing module coming soon. This will include invoice generation, payments, and aging reports.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
