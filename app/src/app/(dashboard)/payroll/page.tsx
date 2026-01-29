import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Payroll',
    description: 'Manage payroll runs',
};

export default function PayrollPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Payroll"
                description="Manage payroll runs and salary processing"
                breadcrumbs={[{ label: 'Payroll' }]}
                actions={
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Generate Payroll
                    </Button>
                }
            />

            <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                        Payroll module coming soon. This will include payroll runs, exceptions, and loan deductions.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
