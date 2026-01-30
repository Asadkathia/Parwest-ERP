import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { KPICard } from '@/components/dashboard/kpi-card';
import { AlertList, Alert } from '@/components/dashboard/alert-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Users,
    UserPlus,
    Shield,
    FileCheck,
    Clock,
    AlertTriangle,
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'HR Dashboard',
    description: 'Guard verification and onboarding management',
};

const kpis = [
    { title: 'Total Guards', value: 245, change: { value: 5, label: 'this month' }, icon: Users, trend: 'up' as const },
    { title: 'Pending Verification', value: 8, icon: Shield, iconColor: 'text-warning' },
    { title: 'Pending Onboarding', value: 4, icon: UserPlus, iconColor: 'text-primary' },
    { title: 'Verified This Month', value: 12, change: { value: 3, label: 'vs last month' }, icon: FileCheck, iconColor: 'text-success', trend: 'up' as const },
    { title: 'Clearance Pending', value: 3, icon: Clock, iconColor: 'text-warning' },
];

const alerts: Alert[] = [
    {
        id: '1',
        title: 'Verification Deadline Approaching',
        message: '3 guards must complete police verification by Feb 5, 2026',
        severity: 'warning',
        timestamp: '1 hour ago',
    },
    {
        id: '2',
        title: 'Document Expiry Alert',
        message: '5 guards have CNICs expiring within 30 days',
        severity: 'warning',
        timestamp: '3 hours ago',
    },
    {
        id: '3',
        title: 'Onboarding Session Scheduled',
        message: 'New guard orientation on Feb 3, 2026 at 10:00 AM',
        severity: 'info',
        timestamp: '1 day ago',
    },
];

const pendingVerification = [
    { name: 'Muhammad Ali Khan', id: 'PW-2026-001', stage: 'Police Verification', daysWaiting: 5, priority: 'high' },
    { name: 'Ahmed Hassan', id: 'PW-2026-002', stage: 'Reference Check', daysWaiting: 3, priority: 'medium' },
    { name: 'Bilal Tariq', id: 'PW-2026-003', stage: 'Medical Clearance', daysWaiting: 7, priority: 'high' },
    { name: 'Usman Raza', id: 'PW-2026-004', stage: 'Police Verification', daysWaiting: 2, priority: 'low' },
];

const pendingOnboarding = [
    { name: 'Hassan Ali', id: 'PW-2026-005', status: 'Documents Pending', progress: 60 },
    { name: 'Raza Ahmed', id: 'PW-2026-006', status: 'Training Scheduled', progress: 80 },
    { name: 'Tariq Mahmood', id: 'PW-2026-007', status: 'Uniform Issued', progress: 90 },
    { name: 'Imran Khan', id: 'PW-2026-008', status: 'Documents Pending', progress: 40 },
];

export default function HRDashboardPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="HR Dashboard"
                description="Guard verification and onboarding management"
                breadcrumbs={[{ label: 'Dashboard' }, { label: 'HR' }]}
            />

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {kpis.map((kpi) => (
                    <KPICard key={kpi.title} {...kpi} />
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Alerts */}
                <AlertList alerts={alerts} title="HR Alerts" />

                {/* Pending Verification */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Pending Verification</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {pendingVerification.map((guard) => (
                                <div key={guard.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium">{guard.name}</p>
                                        <p className="text-xs text-muted-foreground">{guard.id}</p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">{guard.stage}</Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {guard.daysWaiting} days waiting
                                            </span>
                                        </div>
                                    </div>
                                    {guard.priority === 'high' && (
                                        <AlertTriangle className="h-4 w-4 text-warning" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Onboarding */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Pending Onboarding</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {pendingOnboarding.map((guard) => (
                            <div key={guard.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">{guard.name}</p>
                                        <p className="text-xs text-muted-foreground">{guard.id} • {guard.status}</p>
                                    </div>
                                    <span className="text-sm font-medium">{guard.progress}%</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all"
                                        style={{ width: `${guard.progress}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
