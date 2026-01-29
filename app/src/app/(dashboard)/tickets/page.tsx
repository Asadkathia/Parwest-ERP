import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
    title: 'Tickets',
    description: 'Manage support tickets',
};

export default function TicketsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Tickets"
                description="Manage support tickets and requests"
                breadcrumbs={[{ label: 'Tickets' }]}
            />

            <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                        Tickets module coming soon. This will include ticket queue, assignments, and resolution tracking.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
