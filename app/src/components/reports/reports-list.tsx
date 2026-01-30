'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, TrendingUp, Users, DollarSign, Clock } from 'lucide-react';

const reportCategories = [
    {
        title: 'Operational Reports',
        icon: TrendingUp,
        reports: [
            { name: 'Daily Attendance Summary', format: 'PDF, CSV' },
            { name: 'Guard Deployment History', format: 'CSV' },
            { name: 'Incident Logs (Monthly)', format: 'PDF' },
            { name: 'Weapon Inventory Audit', format: 'PDF' },
        ]
    },
    {
        title: 'Financial Reports',
        icon: DollarSign,
        reports: [
            { name: 'Payroll Register (Feb 2026)', format: 'XLXS, CSV' },
            { name: 'Invoice Aging Report', format: 'PDF' },
            { name: 'Client Revenue Analysis', format: 'XLXS' },
            { name: 'Deductions & Recoveries', format: 'CSV' },
        ]
    },
    {
        title: 'HR & Staffing',
        icon: Users,
        reports: [
            { name: 'Active Employee List', format: 'CSV' },
            { name: 'Turnover Rate (Quarterly)', format: 'PDF' },
            { name: 'Training & Certifications', format: 'PDF' },
            { name: 'Security Clearance Status', format: 'CSV' },
        ]
    },
    {
        title: 'Performance & Compliance',
        icon: Clock,
        reports: [
            { name: 'Attendance Reliability Score', format: 'XLXS' },
            { name: 'SLA Breach Report', format: 'PDF' },
            { name: 'Customer Satisfaction Feedback', format: 'PDF' },
        ]
    }
];

export function ReportsList() {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {reportCategories.map((category) => (
                <Card key={category.title} className="shadow-sm">
                    <CardHeader className="flex flex-row items-center gap-4 py-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <category.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-base">{category.title}</CardTitle>
                            <CardDescription>
                                {category.reports.length} reports available
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {category.reports.map((report) => (
                            <div key={report.name} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">{report.name}</p>
                                    <p className="text-xs text-muted-foreground">Format: {report.format}</p>
                                </div>
                                <Button variant="ghost" size="sm" className="h-8 w-8">
                                    <Download className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
