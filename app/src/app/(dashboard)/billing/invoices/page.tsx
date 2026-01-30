import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/protected-button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, Download } from 'lucide-react';
import { BillingStats } from '@/components/billing/billing-stats';
import { InvoicesTable } from '@/components/billing/invoices-table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export const metadata: Metadata = {
    title: 'Invoices',
    description: 'Manage client billing and invoices',
};

export default function InvoicesPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Invoices"
                description="Manage client billing, payments, and collections"
                breadcrumbs={[{ label: 'Billing' }, { label: 'Invoices' }]}
                actions={
                    <>
                        <ProtectedButton
                            module="billing"
                            action="export"
                            variant="outline"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Report
                        </ProtectedButton>
                        <ProtectedButton
                            module="billing"
                            action="create"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Invoice
                        </ProtectedButton>
                    </>
                }
            />

            {/* Billing KPIs */}
            <BillingStats />

            {/* Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-2 w-full md:w-auto">
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Invoices</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Client" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Clients</SelectItem>
                            <SelectItem value="abc">ABC Bank</SelectItem>
                            <SelectItem value="tech">TechFlow</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search invoice # or client..." className="pl-10 w-full md:w-[250px]" />
                </div>
            </div>

            {/* Invoices Table */}
            <InvoicesTable />
        </div>
    );
}
