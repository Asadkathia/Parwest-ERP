import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { KPICard } from '@/components/dashboard/kpi-card';
import { AlertList, Alert } from '@/components/dashboard/alert-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Users,
    MapPin,
    Calendar,
    TicketIcon,
    AlertTriangle,
    TrendingDown,
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Manager Dashboard',
    description: 'Operations overview and staffing management',
};

const kpis = [
    { title: 'Total Deployments', value: 156, change: { value: 3, label: 'vs last week' }, icon: MapPin, trend: 'up' as const },
    { title: 'Staffing Gaps', value: 8, change: { value: -2, label: 'vs yesterday' }, icon: AlertTriangle, iconColor: 'text-warning', trend: 'down' as const },
    { title: 'Attendance Today', value: '94.2%', change: { value: -1.5, label: 'vs yesterday' }, icon: Calendar, trend: 'down' as const },
    { title: 'Open Tickets', value: 7, change: { value: 1, label: 'vs yesterday' }, icon: TicketIcon, trend: 'up' as const },
    { title: 'Available Guards', value: 23, icon: Users, iconColor: 'text-success' },
    { title: 'Pending Swaps', value: 4, icon: Users, iconColor: 'text-warning' },
};

const alerts: Alert[] = [
    {
        id: '1',
        title: 'Urgent: Night Shift Coverage',
        message: 'Metro Mall needs 2 guards for tonight (8 PM - 6 AM)',
        severity: 'critical',
        timestamp: '5 minutes ago',
    },
    {
        id: '2',
        title: 'High Absenteeism Alert',
        message: 'Gulberg region showing 12% absence rate today',
        severity: 'warning',
        timestamp: '1 hour ago',
    },
    {
        id: '3',
        title: 'Deployment Request Pending',
        message: 'ABC Bank - DHA Branch requesting 2 additional guards',
        severity: 'warning',
        timestamp: '3 hours ago',
    },
];

const staffingGaps = [
    { site: 'Metro Mall - Main Entrance', required: 8, assigned: 6, gap: 2, shift: 'Night', priority: 'critical' },
    { site: 'ABC Bank - Gulberg', required: 4, assigned: 3, gap: 1, shift: 'Day', priority: 'high' },
    { site: 'TechFlow - Head Office', required: 3, assigned: 2, gap: 1, shift: 'Night', priority: 'medium' },
    { site: 'Beaconhouse - Garden Town', required: 5, assigned: 4, gap: 1, shift: 'Day', priority: 'medium' },
];

export default function ManagerDashboardPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Manager Dashboard"
                description="Operations overview and staffing management"
                breadcrumbs={[{ label: 'Dashboard' }, { label: 'Manager' }]}
            />

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {kpis.map((kpi) => (
                    <KPICard key={kpi.title} {...kpi} />
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Alerts */}
                <AlertList alerts={alerts} title="Urgent Alerts" />

                {/* Staffing Gaps */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Staffing Gaps</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {staffingGaps.map((gap, index) => (
                                <div key={index} className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium">{gap.site}</p>
                                            <Badge variant={gap.priority === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                                                {gap.shift}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Required: {gap.required} | Assigned: {gap.assigned}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-destructive">-{gap.gap}</p>
                                        <p className="text-xs text-muted-foreground">short</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Open Tickets */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Open Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[
                            { id: 'TKT-089', title: 'Guard uniform replacement needed', site: 'Metro Mall', priority: 'medium' },
                            { id: 'TKT-088', title: 'Radio equipment malfunction', site: 'ABC Bank', priority: 'high' },
                            { id: 'TKT-087', title: 'Access card issue', site: 'TechFlow', priority: 'low' },
                        ].map((ticket) => (
                            <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg border">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">{ticket.title}</p>
                                    <p className="text-xs text-muted-foreground">{ticket.id} • {ticket.site}</p>
                                </div>
                                <Badge variant={ticket.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                                    {ticket.priority}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
