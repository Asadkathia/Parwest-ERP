'use client';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreHorizontal, FileText, Download } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock Payroll Data
const payrollData = [
    {
        id: '1',
        name: 'Ali Hassan',
        designation: 'Security Guard',
        basic_salary: 32000,
        allowances: 4500,
        deductions: 0,
        net_payable: 36500,
        status: 'pending',
    },
    {
        id: '2',
        name: 'Usman Ali',
        designation: 'Supervisor',
        basic_salary: 45000,
        allowances: 5000,
        deductions: 2000, // Loan
        net_payable: 48000,
        status: 'draft',
    },
    {
        id: '3',
        name: 'Kamran Khan',
        designation: 'Security Guard',
        basic_salary: 32000,
        allowances: 1200, // Overtime
        deductions: 500, // Uniform
        net_payable: 32700,
        status: 'verified',
    },
    {
        id: '4',
        name: 'Bilal Ahmed',
        designation: 'CCTV Operator',
        basic_salary: 35000,
        allowances: 0,
        deductions: 0,
        net_payable: 35000,
        status: 'pending',
    },
    {
        id: '5',
        name: 'Tariq Mehmood',
        designation: 'Head Guard',
        basic_salary: 38000,
        allowances: 2000,
        deductions: 1500,
        net_payable: 38500,
        status: 'processed',
    },
];

export function PayrollTable() {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Payroll Ledger - Feb 2026</CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export Bank File
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead className="text-right">Basic Salary</TableHead>
                            <TableHead className="text-right">Allowances</TableHead>
                            <TableHead className="text-right">Deductions</TableHead>
                            <TableHead className="text-right">Net Payable</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payrollData.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{item.name}</span>
                                        <span className="text-xs text-muted-foreground">{item.designation}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                    {item.basic_salary.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-success">
                                    +{item.allowances.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-destructive">
                                    -{item.deductions.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold">
                                    {item.net_payable.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            item.status === 'processed' ? 'default' :
                                                item.status === 'verified' ? 'outline' : 'secondary'
                                        }
                                        className="capitalize"
                                    >
                                        {item.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem>
                                                <FileText className="h-4 w-4 mr-2" />
                                                View Slip
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>Edit Adjustment</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
