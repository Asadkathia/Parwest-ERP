import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { ReportsList } from '@/components/reports/reports-list';

export const metadata: Metadata = {
    title: 'Reports',
    description: 'Analytics and downloadable reports',
};

export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Reports & Analytics"
                description="Generate performance summaries and audit logs"
                breadcrumbs={[{ label: 'Reports' }]}
                actions={
                    <>
                        <Button variant="outline">
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            Date Range: Last 30 Days
                        </Button>
                    </>
                }
            />

            {/* Main Reports Grid */}
            <ReportsList />
        </div>
    );
}
