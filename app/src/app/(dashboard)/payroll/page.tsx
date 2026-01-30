import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/protected-button';
import { Input } from '@/components/ui/input';
import { Download, Calendar as CalendarIcon, Filter, Play, RefreshCw, Search } from 'lucide-react';
import { PayrollStats } from '@/components/payroll/payroll-stats';
import { PayrollTable } from '@/components/payroll/payroll-table';
import { PayrollWorkflow } from '@/components/payroll/payroll-workflow';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export const metadata: Metadata = {
    title: 'Payroll',
    description: 'Manage payroll runs',
};

export default function PayrollPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Payroll Management"
                description="Process salaries, deductions, and generate payslips"
                breadcrumbs={[{ label: 'Payroll' }]}
                actions={
                    <>
                        <Button variant="outline">
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            Feb 2026
                        </Button>
                        <ProtectedButton
                            module="payroll"
                            action="edit"
                            variant="outline"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Recalculate
                        </ProtectedButton>
                        <ProtectedButton
                            module="payroll"
                            action="approve"
                        >
                            <Play className="h-4 w-4 mr-2" />
                            Run Payroll
                        </ProtectedButton>
                    </>
                }
            />

            {/* Workflow Status */}
            <PayrollWorkflow />

            {/* Stats */}
            <PayrollStats />

            {/* Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-2 w-full md:w-auto">
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Guards</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="verified">Verified</SelectItem>
                            <SelectItem value="processed">Processed</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            <SelectItem value="guards">Guards</SelectItem>
                            <SelectItem value="supervisors">Supervisors</SelectItem>
                            <SelectItem value="staff">Office Staff</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search employee..." className="pl-10 w-full md:w-[250px]" />
                </div>
            </div>

            {/* Main Table */}
            <PayrollTable />
        </div>
    );
}
