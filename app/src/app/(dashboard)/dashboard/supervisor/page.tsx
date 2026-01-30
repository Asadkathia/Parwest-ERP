import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { KPICard } from '@/components/dashboard/kpi-card';
import { AlertList, Alert } from '@/components/dashboard/alert-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    MapPin,
    Users,
    CheckCircle2,
    XCircle,
    Clock,
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Supervisor Dashboard',
    description: 'Branch coverage and attendance monitoring',
};

const kpis = [
    { title: 'My Branches', value: 5, icon: MapPin, iconColor: 'text-primary' },
    { title: 'Guards Under Me', value: 42, icon: Users, iconColor: 'text-primary' },
    { title: 'Present Today', value: 39, change: { value: -3, label: 'vs yesterday' }, icon: CheckCircle2, iconColor: 'text-success', trend: 'down' as const },
    { title: 'Absent Today', value: 3, icon: XCircle, iconColor: 'text-destructive' },
    { title: 'Coverage Rate', value: '92.9%', change: { value: -2.1, label: 'vs yesterday' }, icon: CheckCircle2, trend: 'down' as const },
];

const alerts: Alert[] = [
    {
        id: '1',
        title: 'Guard Not Checked In',
        message: 'Hassan Raza (PW-2024-012) has not checked in at Metro Mall',
        severity: 'warning',
        timestamp: '30 minutes ago',
    },
    {
        id: '2',
        title: 'Shift Handover Pending',
        message: 'ABC Bank - Gulberg night shift handover not confirmed',
        severity: 'warning',
        timestamp: '1 hour ago',
    },
];

const branchCoverage = [
    { branch: 'Metro Mall - Main Entrance', guards: 8, present: 7, absent: 1, coverage: 87.5 },
    { branch: 'ABC Bank - Gulberg', guards: 4, present: 4, absent: 0, coverage: 100 },
    { branch: 'ABC Bank - Model Town', guards: 2, present: 2, absent: 0, coverage: 100 },
    { branch: 'TechFlow - Head Office', guards: 3, present: 3, absent: 0, coverage: 100 },
    { branch: 'Beaconhouse - Garden Town', guards: 5, present: 4, absent: 1, coverage: 80 },
];

const absentGuards = [
    { name: 'Hassan Raza', id: 'PW-2024-012', site: 'Metro Mall', shift: 'Day', reason: 'Not reported' },
    { name: 'Ali Ahmed', id: 'PW-2024-034', site: 'Beaconhouse', shift: 'Day', reason: 'Sick leave' },
    { name: 'Usman Khan', id: 'PW-2024-056', site: 'Metro Mall', shift: 'Night', reason: 'Emergency' },
];

export default function SupervisorDashboardPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Supervisor Dashboard"
                description="Branch coverage and attendance monitoring"
                breadcrumbs={[{ label: 'Dashboard' }, { label: 'Supervisor' }]}
            />

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {kpis.map((kpi) => (
                    <KPICard key={kpi.title} {...kpi} />
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Alerts */}
                <AlertList alerts={alerts} title="Today's Alerts" />

                {/* Absent Guards */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Absent Guards Today</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {absentGuards.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                All guards present today
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {absentGuards.map((guard) => (
                                    <div key={guard.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-destructive/5">
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium">{guard.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {guard.id} • {guard.site} • {guard.shift} Shift
                                            </p>
                                            <Badge variant="outline" className="text-xs">{guard.reason}</Badge>
                                        </div>
                                        <XCircle className="h-5 w-5 text-destructive" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Branch Coverage */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Branch Coverage Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {branchCoverage.map((branch) => (
                            <div key={branch.branch} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{branch.branch}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">
                                            {branch.present}/{branch.guards} present
                                        </span>
                                        <Badge variant={branch.coverage === 100 ? 'default' : 'secondary'} className="text-xs">
                                            {branch.coverage}%
                                        </Badge>
                                    </div>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${branch.coverage === 100 ? 'bg-success' : 'bg-warning'}`}
                                        style={{ width: `${branch.coverage}%` }}
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
