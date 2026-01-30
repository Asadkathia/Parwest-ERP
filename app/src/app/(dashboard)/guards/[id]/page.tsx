import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
    FileText,
    MapPin,
    Calendar,
    Wallet,
    Clock,
    ShieldCheck,
    Download,
    Edit,
    Printer,
    ChevronLeft
} from 'lucide-react';
import Link from 'next/link';
import { GuardOverview } from '@/components/guards/guard-overview';
import { GuardDocuments } from '@/components/guards/guard-documents';
import { GuardVerification } from '@/components/guards/guard-verification';
import { GuardDeployments } from '@/components/guards/guard-deployments';
import { GuardAttendance } from '@/components/guards/guard-attendance';
import { GuardPayroll } from '@/components/guards/guard-payroll';
import { GuardLoans } from '@/components/guards/guard-loans';
import { GuardActivity } from '@/components/guards/guard-activity';
import { GuardClearance } from '@/components/guards/guard-clearance';
import { GuardWorkflow } from '@/components/guards/guard-workflow';

export const metadata: Metadata = {
    title: 'Guard Case File',
    description: 'Guard details and history',
};

// Mock Data
const guardData = {
    id: '1',
    parwest_id: 'PW-2024-001',
    name: 'Muhammad Ali Khan',
    cnic: '33100-1234567-1',
    designation: 'Security Guard',
    status: 'active',
    avatar: '/avatars/01.png',
    contact: '+92 300 1234567',
    email: 'ali.khan@example.com',
    joining_date: '2024-01-15',
    current_deployment: 'ABC Bank - Gulberg Branch',
    region: 'Lahore',
};

export default function GuardCaseFilePage({ params }: { params: { id: string } }) {
    return (
        <div className="space-y-6">
            {/* Header with Back Button */}
            <div className="flex flex-col gap-4">
                <Link
                    href="/guards"
                    className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Guards List
                </Link>

                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
                            <AvatarImage src={guardData.avatar} alt={guardData.name} />
                            <AvatarFallback className="text-lg bg-primary/10 text-primary">
                                {guardData.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight">{guardData.name}</h1>
                                <Badge variant="default" className="bg-success text-success-foreground hover:bg-success/90">
                                    {guardData.status}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    {guardData.parwest_id}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {guardData.region}
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="font-mono">{guardData.cnic}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                            <Printer className="h-4 w-4 mr-2" />
                            Print Profile
                        </Button>
                        <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Download CV
                        </Button>
                        <Button size="sm">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Profile
                        </Button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-10 h-auto p-1 bg-muted/50">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="verification">Verification</TabsTrigger>
                    <TabsTrigger value="deployments">Deployments</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="payroll">Payroll</TabsTrigger>
                    <TabsTrigger value="loans">Loans</TabsTrigger>
                    <TabsTrigger value="clearance">Clearance</TabsTrigger>
                    <TabsTrigger value="workflow">Workflow</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-6">
                    <GuardOverview guard={guardData} />
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="mt-6">
                    <GuardDocuments />
                </TabsContent>

                {/* Verification Tab */}
                <TabsContent value="verification" className="mt-6">
                    <GuardVerification />
                </TabsContent>

                {/* Deployments Tab */}
                <TabsContent value="deployments" className="mt-6">
                    <GuardDeployments />
                </TabsContent>

                {/* Attendance Tab */}
                <TabsContent value="attendance" className="mt-6">
                    <GuardAttendance />
                </TabsContent>

                {/* Payroll Tab */}
                <TabsContent value="payroll" className="mt-6">
                    <GuardPayroll />
                </TabsContent>

                {/* Loans Tab */}
                <TabsContent value="loans" className="mt-6">
                    <GuardLoans />
                </TabsContent>

                {/* Clearance Tab */}
                <TabsContent value="clearance" className="mt-6">
                    <GuardClearance />
                </TabsContent>

                {/* Workflow Tab */}
                <TabsContent value="workflow" className="mt-6">
                    <GuardWorkflow />
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="mt-6">
                    <GuardActivity />
                </TabsContent>
            </Tabs>
        </div>
    );
}
