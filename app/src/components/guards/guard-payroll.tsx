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
import { Download, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

// Mock payroll data
const currentSalary = {
    basic: 35000,
    allowances: {
        housing: 5000,
        transport: 3000,
        food: 2000,
    },
    deductions: {
        tax: 1500,
        loan: 2000,
        advance: 1000,
    },
};

const totalAllowances = Object.values(currentSalary.allowances).reduce((a, b) => a + b, 0);
const totalDeductions = Object.values(currentSalary.deductions).reduce((a, b) => a + b, 0);
const grossSalary = currentSalary.basic + totalAllowances;
const netSalary = grossSalary - totalDeductions;

const payrollHistory = [
    { month: 'Jan 2026', gross: 45000, deductions: 4500, net: 40500, status: 'paid' },
    { month: 'Dec 2025', gross: 45000, deductions: 4500, net: 40500, status: 'paid' },
    { month: 'Nov 2025', gross: 45000, deductions: 3500, net: 41500, status: 'paid' },
    { month: 'Oct 2025', gross: 45000, deductions: 4500, net: 40500, status: 'paid' },
    { month: 'Sep 2025', gross: 42000, deductions: 4200, net: 37800, status: 'paid' },
    { month: 'Aug 2025', gross: 42000, deductions: 4200, net: 37800, status: 'paid' },
];

const ytdEarnings = payrollHistory.reduce((sum, record) => sum + record.net, 0);

export function GuardPayroll() {
    return (
        <div className="space-y-6">
            {/* Current Salary Breakdown */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Current Salary Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Basic Salary</span>
                                <span className="font-medium">Rs. {currentSalary.basic.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground pl-4">+ Housing Allowance</span>
                                <span className="font-medium">Rs. {currentSalary.allowances.housing.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground pl-4">+ Transport Allowance</span>
                                <span className="font-medium">Rs. {currentSalary.allowances.transport.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground pl-4">+ Food Allowance</span>
                                <span className="font-medium">Rs. {currentSalary.allowances.food.toLocaleString()}</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between">
                                <span className="font-medium">Gross Salary</span>
                                <span className="font-bold">Rs. {grossSalary.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                            <div className="flex justify-between text-sm text-destructive">
                                <span>- Income Tax</span>
                                <span>Rs. {currentSalary.deductions.tax.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm text-destructive">
                                <span>- Loan Deduction</span>
                                <span>Rs. {currentSalary.deductions.loan.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm text-destructive">
                                <span>- Advance Recovery</span>
                                <span>Rs. {currentSalary.deductions.advance.toLocaleString()}</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between">
                                <span className="font-medium">Net Payable</span>
                                <span className="font-bold text-success">Rs. {netSalary.toLocaleString()}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Year-to-Date Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Total Earnings (2026)</span>
                                </div>
                                <span className="text-lg font-bold">Rs. {ytdEarnings.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-success" />
                                    <span className="text-sm text-muted-foreground">Avg. Monthly</span>
                                </div>
                                <span className="text-lg font-medium">Rs. {Math.round(ytdEarnings / payrollHistory.length).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingDown className="h-4 w-4 text-destructive" />
                                    <span className="text-sm text-muted-foreground">Total Deductions</span>
                                </div>
                                <span className="text-lg font-medium text-destructive">
                                    Rs. {payrollHistory.reduce((sum, r) => sum + r.deductions, 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Payslip History */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Payslip History</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Month</TableHead>
                                <TableHead className="text-right">Gross Salary</TableHead>
                                <TableHead className="text-right">Deductions</TableHead>
                                <TableHead className="text-right">Net Payable</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payrollHistory.map((record) => (
                                <TableRow key={record.month}>
                                    <TableCell className="font-medium">{record.month}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        Rs. {record.gross.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm text-destructive">
                                        Rs. {record.deductions.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm font-medium">
                                        Rs. {record.net.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="default" className="capitalize">
                                            {record.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm">
                                            <Download className="h-4 w-4" />
                                        </Button>
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
