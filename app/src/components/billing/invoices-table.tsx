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
import { MoreHorizontal, FileText, Download, Send } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock Invoice Data
const invoices = [
    {
        id: 'INV-2026-001',
        client: 'ABC Bank Limited',
        issue_date: '2026-02-01',
        due_date: '2026-02-15',
        amount: 450000,
        balance: 450000,
        status: 'pending',
    },
    {
        id: 'INV-2026-002',
        client: 'TechFlow Solutions',
        issue_date: '2026-01-15',
        due_date: '2026-01-30',
        amount: 125000,
        balance: 0,
        status: 'paid',
    },
    {
        id: 'INV-2026-003',
        client: 'Beaconhouse School',
        issue_date: '2026-01-10',
        due_date: '2026-01-25',
        amount: 280000,
        balance: 280000,
        status: 'overdue',
    },
    {
        id: 'INV-2026-004',
        client: 'Metro Cash & Carry',
        issue_date: '2026-02-01',
        due_date: '2026-02-15',
        amount: 550000,
        balance: 550000,
        status: 'draft',
    },
    {
        id: 'INV-2026-005',
        client: 'Gulberg Heights',
        issue_date: '2026-01-20',
        due_date: '2026-02-05',
        amount: 95000,
        balance: 0,
        status: 'paid',
    },
];

export function InvoicesTable() {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Recent Invoices</CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export List
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Issue Date</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((inv) => (
                            <TableRow key={inv.id}>
                                <TableCell className="font-mono font-medium">{inv.id}</TableCell>
                                <TableCell>{inv.client}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{inv.issue_date}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{inv.due_date}</TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                    {inv.amount.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                    {inv.balance.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            inv.status === 'paid' ? 'default' :
                                                inv.status === 'overdue' ? 'destructive' :
                                                    inv.status === 'draft' ? 'secondary' : 'outline'
                                        }
                                        className="capitalize"
                                    >
                                        {inv.status}
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
                                                View Invoice
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <Send className="h-4 w-4 mr-2" />
                                                Send Email
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>Record Payment</DropdownMenuItem>
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
