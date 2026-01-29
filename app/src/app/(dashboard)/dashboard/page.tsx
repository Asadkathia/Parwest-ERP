import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Users,
    Building2,
    Calendar,
    Wallet,
    FileText,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Plus,
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Dashboard',
    description: 'Overview of your security operations',
};

// Mock data for KPIs
const kpiData = [
    {
        title: 'Active Guards',
        value: '1,247',
        change: '+12',
        trend: 'up' as const,
        icon: Users,
        color: 'text-primary',
    },
    {
        title: 'Deployed Today',
        value: '1,089',
        change: '-23',
        trend: 'down' as const,
        icon: Building2,
        color: 'text-success',
    },
    {
        title: 'Attendance Rate',
        value: '94.2%',
        change: '+2.1%',
        trend: 'up' as const,
        icon: Calendar,
        color: 'text-info',
    },
    {
        title: 'Outstanding Invoices',
        value: 'PKR 2.4M',
        change: '-340K',
        trend: 'down' as const,
        icon: FileText,
        color: 'text-warning',
    },
    {
        title: 'Payroll (MTD)',
        value: 'PKR 8.7M',
        change: '+1.2M',
        trend: 'up' as const,
        icon: Wallet,
        color: 'text-primary',
    },
    {
        title: 'Open Tickets',
        value: '23',
        change: '+5',
        trend: 'up' as const,
        icon: AlertTriangle,
        color: 'text-destructive',
    },
];

// Mock alerts
const alerts = [
    {
        id: '1',
        type: 'expiry',
        title: 'CNIC Expiring Soon',
        description: '12 guards have CNIC expiring in next 30 days',
        severity: 'high' as const,
    },
    {
        id: '2',
        type: 'missing',
        title: 'Missing Attendance',
        description: '5 branches have not submitted attendance today',
        severity: 'medium' as const,
    },
    {
        id: '3',
        type: 'overdue',
        title: 'Overdue Payments',
        description: '3 clients have invoices overdue by 60+ days',
        severity: 'critical' as const,
    },
];

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Command Center"
                description="Welcome back! Here's what's happening with your operations today."
                actions={
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Quick Action
                    </Button>
                }
            />

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {kpiData.map((kpi, index) => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={index} className="shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {kpi.title}
                                </CardTitle>
                                <Icon className={`h-4 w-4 ${kpi.color}`} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{kpi.value}</div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    {kpi.trend === 'up' ? (
                                        <TrendingUp className="h-3 w-3 text-success" />
                                    ) : (
                                        <TrendingDown className="h-3 w-3 text-destructive" />
                                    )}
                                    <span
                                        className={
                                            kpi.trend === 'up' ? 'text-success' : 'text-destructive'
                                        }
                                    >
                                        {kpi.change}
                                    </span>
                                    <span>from yesterday</span>
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Alerts */}
                <Card className="lg:col-span-1 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            Critical Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {alerts.map((alert) => (
                            <div
                                key={alert.id}
                                className={`rounded-lg p-3 border-l-4 ${alert.severity === 'critical'
                                        ? 'border-destructive bg-destructive/5'
                                        : alert.severity === 'high'
                                            ? 'border-warning bg-warning/5'
                                            : 'border-info bg-info/5'
                                    }`}
                            >
                                <p className="text-sm font-medium">{alert.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {alert.description}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="lg:col-span-1 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                            <Users className="h-5 w-5" />
                            <span className="text-xs">Add Guard</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                            <Building2 className="h-5 w-5" />
                            <span className="text-xs">Add Client</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                            <Calendar className="h-5 w-5" />
                            <span className="text-xs">Mark Attendance</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                            <FileText className="h-5 w-5" />
                            <span className="text-xs">Generate Invoice</span>
                        </Button>
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="lg:col-span-1 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                {
                                    action: 'Guard deployed',
                                    detail: 'Muhammad Ali deployed to ABC Bank, Gulberg',
                                    time: '10 min ago',
                                },
                                {
                                    action: 'Invoice generated',
                                    detail: 'Invoice #2024-0142 for XYZ Corp - PKR 450,000',
                                    time: '25 min ago',
                                },
                                {
                                    action: 'Attendance submitted',
                                    detail: 'Branch North-05 attendance marked by Supervisor',
                                    time: '1 hour ago',
                                },
                                {
                                    action: 'New guard enrolled',
                                    detail: 'Hassan Raza - CNIC verified, pending deployment',
                                    time: '2 hours ago',
                                },
                            ].map((item, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{item.action}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.detail}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {item.time}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
