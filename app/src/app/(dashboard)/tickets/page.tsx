import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter } from 'lucide-react';
import { TicketsStats } from '@/components/tickets/tickets-stats';
import { TicketsTable } from '@/components/tickets/tickets-table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export const metadata: Metadata = {
    title: 'Tickets & Support',
    description: 'Manage issues and support requests',
};

export default function TicketsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Tickets & Support"
                description="Manage operational issues, requests, and helpdesk"
                breadcrumbs={[{ label: 'Tickets' }]}
                actions={
                    <>
                        <Button variant="outline">
                            <Filter className="h-4 w-4 mr-2" />
                            Filters
                        </Button>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Ticket
                        </Button>
                    </>
                }
            />

            {/* Ticket Stats */}
            <TicketsStats />

            {/* Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-2 w-full md:w-auto">
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search subject or ID..." className="pl-10 w-full md:w-[250px]" />
                </div>
            </div>

            {/* Main Tickets Table */}
            <TicketsTable />
        </div>
    );
}
