import { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    ChevronLeft,
    Building2,
    MapPin,
    Phone,
    Mail,
    Plus
} from 'lucide-react';
import { ClientOverview } from '@/components/clients/client-overview';
import { ClientBranches } from '@/components/clients/client-branches';

export const metadata: Metadata = {
    title: 'Client Details',
    description: 'View client information and contracts',
};

// Mock data generator for demo
const clientData = {
    id: '1',
    company_name: 'ABC Bank Limited',
    ntn: '1234567-8',
    registration_no: 'CU-2345678',
    contact_person: 'Mr. Asif Iqbal',
    designation: 'Branch Manager',
    email: 'asif.iqbal@abcbank.com',
    phone: '+92 300 1234567',
    landline: '+92 42 35712345',
    region: 'Lahore',
    address: '12-A, Main Boulevard, Gulberg III, Lahore',
    contract_start: '2023-01-01',
    contract_expiry: '2026-12-31',
    status: 'active',
    total_sites: 12,
    active_guards: 45,
    billing_cycle: 'Monthly',
};

export default function ClientDetailsPage({ params }: { params: { id: string } }) {
    return (
        <div className="space-y-6">
            {/* Custom Breadcrumb Back Link */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/clients" className="hover:text-primary flex items-center gap-1 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Clients
                </Link>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        {clientData.company_name}
                        <Badge variant="default" className="text-sm font-normal">Active</Badge>
                    </h1>
                    <div className="text-muted-foreground mt-2 flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" /> Client ID: CL-{clientData.id.padStart(3, '0')}
                        </span>
                        <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" /> {clientData.region}
                        </span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline">Edit Details</Button>
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        New Contract
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="branches">Branches</TabsTrigger>
                    <TabsTrigger value="contracts">Contracts</TabsTrigger>
                    <TabsTrigger value="guards">Guards</TabsTrigger>
                    <TabsTrigger value="invoices">Invoices</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-6">
                    <ClientOverview client={clientData} />
                </TabsContent>

                {/* Branches Tab */}
                <TabsContent value="branches" className="mt-6">
                    <ClientBranches />
                </TabsContent>

                {/* Placeholders */}
                {['contracts', 'guards', 'invoices'].map((tab) => (
                    <TabsContent key={tab} value={tab} className="mt-6">
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <p className="capitalize">{tab} module coming soon.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
