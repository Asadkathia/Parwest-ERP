import { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Plus,
    Search,
    Filter,
    Download,
    MoreHorizontal,
    Eye,
    Edit,
    MapPin,
    FileText,
} from 'lucide-react';
import { CreateGuardDrawer } from '@/components/guards/create-guard-drawer';

export const metadata: Metadata = {
    title: 'Guards',
    description: 'Manage security guards',
};

// Mock data
const guards = [
    {
        id: '1',
        parwest_id: 'PW-2024-001',
        name: 'Muhammad Ali Khan',
        cnic: '33100-1234567-1',
        designation: 'Security Guard',
        status: 'active',
        region: 'Lahore',
        current_deployment: 'ABC Bank - Gulberg Branch',
        contact: '+92 300 1234567',
    },
    {
        id: '2',
        parwest_id: 'PW-2024-002',
        name: 'Hassan Raza',
        cnic: '33100-2345678-2',
        designation: 'Armed Guard',
        status: 'pending_deployment',
        region: 'Lahore',
        current_deployment: null,
        contact: '+92 301 2345678',
    },
    {
        id: '3',
        parwest_id: 'PW-2024-003',
        name: 'Ahmed Hussain',
        cnic: '33100-3456789-3',
        designation: 'Supervisor',
        status: 'active',
        region: 'Islamabad',
        current_deployment: 'XYZ Corp - Blue Area',
        contact: '+92 302 3456789',
    },
    {
        id: '4',
        parwest_id: 'PW-2024-004',
        name: 'Tariq Mehmood',
        cnic: '33100-4567890-4',
        designation: 'Security Guard',
        status: 'suspended',
        region: 'Karachi',
        current_deployment: null,
        contact: '+92 303 4567890',
    },
    {
        id: '5',
        parwest_id: 'PW-2023-150',
        name: 'Imran Siddiqui',
        cnic: '33100-5678901-5',
        designation: 'Armed Guard',
        status: 'active',
        region: 'Lahore',
        current_deployment: 'National Bank - DHA Phase 5',
        contact: '+92 304 5678901',
    },
];

const statusStyles: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Active', variant: 'default' },
    pending_deployment: { label: 'Pending Deployment', variant: 'secondary' },
    suspended: { label: 'Suspended', variant: 'destructive' },
    terminated: { label: 'Terminated', variant: 'outline' },
};

export default function GuardsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Guards"
                description="Manage security guards across all regions"
                breadcrumbs={[{ label: 'Guards' }]}
                actions={
                    <>
                        <Button variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                        <CreateGuardDrawer />
                    </>
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Guards
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1,247</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-success">1,089</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pending Deployment
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-warning">98</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Verification Pending
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-info">42</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Search */}
            <Card className="shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input placeholder="Search by name, CNIC, ID..." className="pl-10" />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                                <Filter className="h-4 w-4 mr-2" />
                                Filters
                            </Button>
                            <Button variant="outline" size="sm">
                                Status
                            </Button>
                            <Button variant="outline" size="sm">
                                Region
                            </Button>
                            <Button variant="outline" size="sm">
                                Designation
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Guards Table */}
            <Card className="shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Guard ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>CNIC</TableHead>
                                <TableHead>Designation</TableHead>
                                <TableHead>Region</TableHead>
                                <TableHead>Current Deployment</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {guards.map((guard) => (
                                <TableRow key={guard.id}>
                                    <TableCell className="font-medium">{guard.parwest_id}</TableCell>
                                    <TableCell>
                                        <Link
                                            href={`/guards/${guard.id}`}
                                            className="font-medium text-primary hover:underline"
                                        >
                                            {guard.name}
                                        </Link>
                                        <p className="text-xs text-muted-foreground">{guard.contact}</p>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">{guard.cnic}</TableCell>
                                    <TableCell>{guard.designation}</TableCell>
                                    <TableCell>{guard.region}</TableCell>
                                    <TableCell>
                                        {guard.current_deployment ? (
                                            <span className="text-sm">{guard.current_deployment}</span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={statusStyles[guard.status]?.variant || 'secondary'}>
                                            {statusStyles[guard.status]?.label || guard.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/guards/${guard.id}`}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View Case File
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem>
                                                    <MapPin className="h-4 w-4 mr-2" />
                                                    Deploy
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <FileText className="h-4 w-4 mr-2" />
                                                    Upload Document
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
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
