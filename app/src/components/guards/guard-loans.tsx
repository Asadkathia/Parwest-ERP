'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Wallet, TrendingDown, CheckCircle2 } from 'lucide-react';

// Mock loans data
const loansSummary = {
    totalBorrowed: 50000,
    totalPaid: 28000,
    outstanding: 22000,
};

const loansHistory = [
    {
        id: 'L-001',
        type: 'Emergency Loan',
        amount: 30000,
        disbursedDate: '2025-06-15',
        installments: 12,
        monthlyDeduction: 2500,
        paid: 17500,
        remaining: 12500,
        status: 'active',
    },
    {
        id: 'L-002',
        type: 'Advance Salary',
        amount: 20000,
        disbursedDate: '2025-11-01',
        installments: 4,
        monthlyDeduction: 5000,
        paid: 10500,
        remaining: 9500,
        status: 'active',
    },
    {
        id: 'L-003',
        type: 'Medical Loan',
        amount: 15000,
        disbursedDate: '2024-08-20',
        installments: 10,
        monthlyDeduction: 1500,
        paid: 15000,
        remaining: 0,
        status: 'completed',
    },
];

const repaymentSchedule = [
    { month: 'Feb 2026', l001: 2500, l002: 5000, total: 7500 },
    { month: 'Mar 2026', l001: 2500, l002: 5000, total: 7500 },
    { month: 'Apr 2026', l001: 2500, l002: 0, total: 2500 },
    { month: 'May 2026', l001: 2500, l002: 0, total: 2500 },
];

export function GuardLoans() {
    return (
        <div className="space-y-6">
            {/* Loans Summary */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Borrowed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-muted-foreground" />
                            <div className="text-2xl font-bold">Rs. {loansSummary.totalBorrowed.toLocaleString()}</div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">All-time</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Paid
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-success" />
                            <div className="text-2xl font-bold text-success">Rs. {loansSummary.totalPaid.toLocaleString()}</div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {Math.round((loansSummary.totalPaid / loansSummary.totalBorrowed) * 100)}% repaid
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Outstanding
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-destructive" />
                            <div className="text-2xl font-bold text-destructive">Rs. {loansSummary.outstanding.toLocaleString()}</div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Remaining balance</p>
                    </CardContent>
                </Card>
            </div>

            {/* Active Loans */}
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base">Loan History</CardTitle>
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Request Loan
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Loan ID</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Monthly</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="text-right">Remaining</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loansHistory.map((loan) => (
                                <TableRow key={loan.id}>
                                    <TableCell className="font-medium">{loan.id}</TableCell>
                                    <TableCell>{loan.type}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        Rs. {loan.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        Rs. {loan.monthlyDeduction.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm text-success">
                                        Rs. {loan.paid.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm text-destructive">
                                        Rs. {loan.remaining.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={loan.status === 'active' ? 'default' : 'secondary'}
                                            className="capitalize"
                                        >
                                            {loan.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Repayment Schedule */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Upcoming Repayment Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Month</TableHead>
                                <TableHead className="text-right">L-001</TableHead>
                                <TableHead className="text-right">L-002</TableHead>
                                <TableHead className="text-right">Total Deduction</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {repaymentSchedule.map((schedule) => (
                                <TableRow key={schedule.month}>
                                    <TableCell className="font-medium">{schedule.month}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        {schedule.l001 > 0 ? `Rs. ${schedule.l001.toLocaleString()}` : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        {schedule.l002 > 0 ? `Rs. ${schedule.l002.toLocaleString()}` : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm font-medium">
                                        Rs. {schedule.total.toLocaleString()}
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
