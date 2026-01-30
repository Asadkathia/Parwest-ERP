import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    Filter,
    FileText,
    Users,
    DollarSign,
    AlertCircle,
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Approval Center',
    description: 'Manage pending approvals',
};

// Mock approval requests
const approvalRequests = [
    {
        id: 'APR-2026-001',
        module: 'Guards',
        type: 'Guard Enrollment',
        requestedBy: 'Ahmed Khan',
        requestedByRole: 'HR Manager',
        date: '2026-01-30',
        status: 'pending',
        details: 'New guard enrollment: Muhammad Ali Khan',
        priority: 'normal',
    },
    {
        id: 'APR-2026-002',
        module: 'Deployments',
        type: 'Deployment Revoke',
        requestedBy: 'Bilal Ahmed',
        requestedByRole: 'Operations Manager',
        date: '2026-01-29',
        status: 'pending',
        details: 'Revoke deployment at ABC Bank - Gulberg',
        priority: 'high',
    },
    {
        id: 'APR-2026-003',
        module: 'Payroll',
        type: 'Payroll Finalization',
        requestedBy: 'Sara Malik',
        requestedByRole: 'Finance Manager',
        date: '2026-01-28',
        status: 'pending',
        details: 'January 2026 payroll finalization',
        priority: 'high',
    },
    {
        id: 'APR-2026-004',
        module: 'Billing',
        type: 'Invoice Void',
        requestedBy: 'Usman Tariq',
        requestedByRole: 'Finance Manager',
        date: '2026-01-27',
        status: 'approved',
        details: 'Void invoice INV-2026-045',
        priority: 'normal',
    },
    {
        id: 'APR-2026-005',
        module: 'Guards',
        type: 'Guard Termination',
        requestedBy: 'Ahmed Khan',
        requestedByRole: 'HR Manager',
        date: '2026-01-26',
        status: 'rejected',
        details: 'Terminate guard PW-2024-018',
        priority: 'normal',
    },
    {
        id: 'APR-2026-006',
        module: 'Clients',
        type: 'Contract Amendment',
        requestedBy: 'Raza Ali',
        requestedByRole: 'Operations Manager',
        date: '2026-01-25',
        status: 'pending',
        details: 'Amend contract for TechFlow Solutions',
        priority: 'low',
    },
];

const stats = [
    { label: 'Pending', value: 4, icon: Clock, color: 'text-warning' },
    { label: 'Approved Today', value: 3, icon: CheckCircle2, color: 'text-success' },
    { label: 'Rejected', value: 1, icon: XCircle, color: 'text-destructive' },
    { label: 'Total Requests', value: 8, icon: FileText, color: 'text-primary' },
];

export default function ApprovalsPage() {
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
            case 'approved':
                return <Badge variant="default" className="bg-success/10 text-success border-success/20">Approved</Badge>;
            case 'rejected':
                return <Badge variant="destructive">Rejected</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'high':
                return <Badge variant="destructive" className="text-xs">High</Badge>;
            case 'normal':
                return <Badge variant="secondary" className="text-xs">Normal</Badge>;
            case 'low':
                return <Badge variant="outline" className="text-xs">Low</Badge>;
            default:
                return null;
        }
    };

    const getModuleIcon = (module: string) => {
        switch (module) {
            case 'Guards':
                return <Users className="h-4 w-4" />;
            case 'Payroll':
            case 'Billing':
                return <DollarSign className="h-4 w-4" />;
            default:
                return <FileText className="h-4 w-4" />;
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Approval Center"
                description="Review and manage pending approval requests"
                breadcrumbs={[{ label: 'Approval Center' }]}
            />

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label} className="shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {stat.label}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold">{stat.value}</span>
                                    <Icon className={`h-5 w-5 ${stat.color}`} />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Filters */}
            <Card className="shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by ID, type, or requester..."
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <Select defaultValue="all">
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select defaultValue="all">
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Module" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Modules</SelectItem>
                                <SelectItem value="guards">Guards</SelectItem>
                                <SelectItem value="deployments">Deployments</SelectItem>
                                <SelectItem value="payroll">Payroll</SelectItem>
                                <SelectItem value="billing">Billing</SelectItem>
                                <SelectItem value="clients">Clients</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Approvals Table */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Approval Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Request ID</TableHead>
                                <TableHead>Module</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Requested By</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {approvalRequests.map((request) => (
                                <TableRow key={request.id}>
                                    <TableCell className="font-mono text-sm">
                                        {request.id}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getModuleIcon(request.module)}
                                            <span>{request.module}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{request.type}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {request.details}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{request.requestedBy}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {request.requestedByRole}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(request.date).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </TableCell>
                                    <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                                    <TableCell className="text-right">
                                        {request.status === 'pending' ? (
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="default">
                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="destructive">
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    Reject
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button size="sm" variant="outline">
                                                View Details
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
