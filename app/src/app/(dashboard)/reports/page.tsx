import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
    title: 'Reports',
    description: 'View and generate reports',
};

export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Reports"
                description="View and generate reports"
                breadcrumbs={[{ label: 'Reports' }]}
            />

            <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                        Reports module coming soon. This will include attendance, payroll, billing, and deployment reports.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
