import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { KPICard } from '@/components/dashboard/kpi-card';
import { AlertList, Alert } from '@/components/dashboard/alert-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Users,
    Building2,
    DollarSign,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Clock,
    Shield,
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Admin Dashboard',
    description: 'System-wide overview and analytics',
};

const kpis = [
    { title: 'Total Guards', value: 245, change: { value: 5, label: 'vs last month' }, icon: Users, trend: 'up' as const },
    { title: 'Active Clients', value: 38, change: { value: 2, label: 'new this month' }, icon: Building2, trend: 'up' as const },
    { title: 'Monthly Revenue', value: 'PKR 4.2M', change: { value: 12, label: 'vs last month' }, icon: DollarSign, trend: 'up' as const },
    { title: 'Deployment Rate', value: '94%', change: { value: -2, label: 'vs last month' }, icon: TrendingUp, trend: 'down' as const },
    { title: 'Attendance Rate', value: '96.5%', change: { value: 1.5, label: 'vs last month' }, icon: CheckCircle2, trend: 'up' as const },
    { title: 'Open Tickets', value: 12, change: { value: -3, label: 'vs last week' }, icon: AlertCircle, trend: 'up' as const },
];

const alerts: Alert[] = [
    {
        id: '1',
        title: 'Critical: Staffing Shortage',
        message: 'Metro Mall requires 2 additional guards for night shift',
        severity: 'critical',
        timestamp: '10 minutes ago',
    },
    {
        id: '2',
        title: 'Payroll Processing Due',
        message: 'January payroll must be finalized by Feb 1, 2026',
        severity: 'warning',
        timestamp: '2 hours ago',
    },
    {
        id: '3',
        title: 'New Client Onboarding',
        message: 'TechHub Solutions contract signed - deployment starts Feb 5',
        severity: 'info',
        timestamp: '5 hours ago',
    },
    {
        id: '4',
        title: 'System Maintenance Scheduled',
        message: 'ERP maintenance window: Feb 1, 2:00 AM - 6:00 AM',
        severity: 'info',
        timestamp: '1 day ago',
    },
];

const recentActivity = [
    { action: 'Guard Enrollment', details: 'Muhammad Ali Khan enrolled', time: '15 min ago' },
    { action: 'Deployment Created', details: 'ABC Bank - Model Town (3 guards)', time: '1 hour ago' },
    { action: 'Invoice Generated', details: 'INV-2026-089 for Metro Mall', time: '2 hours ago' },
    { action: 'Attendance Marked', details: 'Daily attendance completed', time: '3 hours ago' },
    { action: 'Contract Renewed', details: 'Beaconhouse School - 1 year extension', time: '5 hours ago' },
];

export default function AdminDashboardPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Admin Dashboard"
                description="System-wide overview and analytics"
                breadcrumbs={[{ label: 'Dashboard' }, { label: 'Admin' }]}
            />

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {kpis.map((kpi) => (
                    <KPICard key={kpi.title} {...kpi} />
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Alerts */}
                <AlertList alerts={alerts} />

                {/* Recent Activity */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recentActivity.map((activity, index) => (
                                <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                        <Clock className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium">{activity.action}</p>
                                        <p className="text-xs text-muted-foreground">{activity.details}</p>
                                        <p className="text-xs text-muted-foreground/70">{activity.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Trends Chart Placeholder */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Performance Trends</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-64 bg-muted/50 rounded-lg">
                        <div className="text-center space-y-2">
                            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto" />
                            <p className="text-sm text-muted-foreground">Chart visualization placeholder</p>
                            <p className="text-xs text-muted-foreground/70">Revenue, Attendance, Deployment trends</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
