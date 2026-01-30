import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { KPICard } from '@/components/dashboard/kpi-card';
import { AlertList, Alert } from '@/components/dashboard/alert-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    DollarSign,
    FileText,
    AlertCircle,
    TrendingUp,
    Clock,
    CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Finance Dashboard',
    description: 'Financial overview and payroll management',
};

const kpis = [
    { title: 'Monthly Revenue', value: 'PKR 4.2M', change: { value: 12, label: 'vs last month' }, icon: DollarSign, trend: 'up' as const },
    { title: 'Outstanding Invoices', value: 'PKR 850K', icon: AlertCircle, iconColor: 'text-warning' },
    { title: 'Overdue Amount', value: 'PKR 320K', icon: AlertCircle, iconColor: 'text-destructive' },
    { title: 'Collected MTD', value: 'PKR 3.1M', change: { value: 8, label: 'vs last month' }, icon: TrendingUp, iconColor: 'text-success', trend: 'up' as const },
    { title: 'Payroll Pending', value: 'PKR 2.8M', icon: Clock, iconColor: 'text-warning' },
    { title: 'Payroll Processed', value: 'PKR 12.5M', change: { value: 5, label: 'this month' }, icon: CheckCircle2, iconColor: 'text-success', trend: 'up' as const },
];

const alerts: Alert[] = [
    {
        id: '1',
        title: 'Payroll Finalization Due',
        message: 'January 2026 payroll must be finalized by Feb 1, 2026',
        severity: 'critical',
        timestamp: '2 hours ago',
    },
    {
        id: '2',
        title: 'Overdue Invoices',
        message: '8 invoices are overdue by more than 30 days (PKR 320K)',
        severity: 'warning',
        timestamp: '5 hours ago',
    },
    {
        id: '3',
        title: 'Large Payment Received',
        message: 'Metro Mall paid PKR 450K for invoice INV-2026-078',
        severity: 'info',
        timestamp: '1 day ago',
    },
];

const outstandingInvoices = [
    { id: 'INV-2026-089', client: 'Metro Mall', amount: 'PKR 450K', dueDate: '2026-02-05', status: 'pending', overdue: false },
    { id: 'INV-2026-085', client: 'ABC Bank', amount: 'PKR 180K', dueDate: '2026-01-28', status: 'overdue', overdue: true },
    { id: 'INV-2026-082', client: 'TechFlow Solutions', amount: 'PKR 120K', dueDate: '2026-01-25', status: 'overdue', overdue: true },
    { id: 'INV-2026-088', client: 'Beaconhouse School', amount: 'PKR 100K', dueDate: '2026-02-10', status: 'pending', overdue: false },
];

const payrollStatus = [
    { month: 'January 2026', guards: 245, amount: 'PKR 2.8M', status: 'pending', progress: 85 },
    { month: 'December 2025', guards: 240, amount: 'PKR 2.7M', status: 'completed', progress: 100 },
    { month: 'November 2025', guards: 238, amount: 'PKR 2.6M', status: 'completed', progress: 100 },
];

export default function FinanceDashboardPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Finance Dashboard"
                description="Financial overview and payroll management"
                breadcrumbs={[{ label: 'Dashboard' }, { label: 'Finance' }]}
            />

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {kpis.map((kpi) => (
                    <KPICard key={kpi.title} {...kpi} />
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Alerts */}
                <AlertList alerts={alerts} title="Finance Alerts" />

                {/* Payroll Status */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Payroll Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {payrollStatus.map((payroll) => (
                                <div key={payroll.month} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{payroll.month}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {payroll.guards} guards • {payroll.amount}
                                            </p>
                                        </div>
                                        <Badge variant={payroll.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                                            {payroll.status}
                                        </Badge>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${payroll.status === 'completed' ? 'bg-success' : 'bg-primary'}`}
                                            style={{ width: `${payroll.progress}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Outstanding Invoices */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Outstanding Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {outstandingInvoices.map((invoice) => (
                            <div
                                key={invoice.id}
                                className={`flex items-center justify-between p-3 rounded-lg border ${invoice.overdue ? 'bg-destructive/5 border-destructive/20' : ''
                                    }`}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium font-mono">{invoice.id}</p>
                                        <Badge variant={invoice.overdue ? 'destructive' : 'secondary'} className="text-xs">
                                            {invoice.status}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {invoice.client} • Due: {new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                                <p className="text-sm font-bold">{invoice.amount}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
