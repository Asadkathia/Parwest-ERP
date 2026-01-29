import { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
    Building2,
    MapPin,
    Phone
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Clients',
    description: 'Manage clients and contracts',
};

// Mock Data
const clients = [
    {
        id: '1',
        company_name: 'ABC Bank Limited',
        contact_person: 'Mr. Asif Iqbal',
        designation: 'Branch Manager',
        email: 'asif.iqbal@abcbank.com',
        phone: '+92 300 1234567',
        region: 'Lahore',
        total_branches: 12,
        active_guards: 45,
        status: 'active',
        contract_expiry: '2026-12-31',
    },
    {
        id: '2',
        company_name: 'TechFlow Solutions',
        contact_person: 'Ms. Sara Ahmed',
        designation: 'HR Director',
        email: 'sara@techflow.com',
        phone: '+92 321 9876543',
        region: 'Islamabad',
        total_branches: 1,
        active_guards: 4,
        status: 'active',
        contract_expiry: '2025-06-30',
    },
    {
        id: '3',
        company_name: 'Gulberg Heights Association',
        contact_person: 'Col (R) Tanveer',
        designation: 'Security In-charge',
        email: 'security@gulbergheights.com',
        phone: '+92 333 4567890',
        region: 'Lahore',
        total_branches: 1,
        active_guards: 8,
        status: 'active',
        contract_expiry: '2025-12-31',
    },
    {
        id: '4',
        company_name: 'Metro Cash & Carry',
        contact_person: 'Mr. Kamran Khan',
        designation: 'Operations Manager',
        email: 'kamran.k@metro.pk',
        phone: '+92 301 1122334',
        region: 'Karachi',
        total_branches: 3,
        active_guards: 25,
        status: 'inactive',
        contract_expiry: '2024-12-31',
    },
    {
        id: '5',
        company_name: 'Beaconhouse School System',
        contact_person: 'Mrs. Naila Kiani',
        designation: 'Admin Officer',
        email: 'admin.lhr@beaconhouse.edu.pk',
        phone: '+92 42 35712345',
        region: 'Lahore',
        total_branches: 5,
        active_guards: 15,
        status: 'active',
        contract_expiry: '2026-03-31',
    }
];

export default function ClientsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Clients"
                description="Manage clients, branches, and service contracts"
                breadcrumbs={[{ label: 'Clients' }]}
                actions={
                    <>
                        <Button variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Client
                        </Button>
                    </>
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Clients
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">28</div>
                        <p className="text-xs text-muted-foreground mt-1">+2 from last month</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active Contracts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-success">24</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Guards Deployed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">342</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Expiring Soon
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-warning">3</div>
                        <p className="text-xs text-muted-foreground mt-1">Contracts expiring in 30 days</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Search */}
            <Card className="shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input placeholder="Search clients, contact person..." className="pl-10" />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                                <Filter className="h-4 w-4 mr-2" />
                                Filters
                            </Button>
                            <Button variant="outline" size="sm">
                                Region
                            </Button>
                            <Button variant="outline" size="sm">
                                Status
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Clients Table */}
            <Card className="shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Company</TableHead>
                                <TableHead>Contact Person</TableHead>
                                <TableHead>Region</TableHead>
                                <TableHead className="text-center">Branches</TableHead>
                                <TableHead className="text-center">Deployed Guards</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {clients.map((client) => (
                                <TableRow key={client.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <Link
                                                href={`/clients/${client.id}`}
                                                className="font-medium text-primary hover:underline flex items-center gap-2"
                                            >
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                {client.company_name}
                                            </Link>
                                            <span className="text-xs text-muted-foreground ml-6">{client.contract_expiry} (Expiry)</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-sm">
                                            <span className="font-medium">{client.contact_person}</span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Phone className="h-3 w-3" /> {client.phone}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <MapPin className="h-3 w-3" />
                                            {client.region}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary" className="font-mono">
                                            {client.total_branches}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="font-mono">
                                            {client.active_guards}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                                            {client.status === 'active' ? 'Active' : 'Inactive'}
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
                                                    <Link href={`/clients/${client.id}`}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View Details
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit Client
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem>
                                                    Add Branch
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    View Contracts
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
