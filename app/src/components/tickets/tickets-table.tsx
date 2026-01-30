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
import { MoreHorizontal, MessageSquare, User } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Mock Tickets Data
const tickets = [
    {
        id: 'TKT-1024',
        subject: 'Laptop screen flickering',
        requester: 'Ali Hassan',
        priority: 'medium',
        status: 'open',
        assignee: 'IT Support',
        updated: '2 hours ago',
    },
    {
        id: 'TKT-1025',
        subject: 'Salary discrepancy Feb 2026',
        requester: 'Usman Ali',
        priority: 'high',
        status: 'open',
        assignee: 'HR Dept',
        updated: '1 day ago',
    },
    {
        id: 'TKT-1023',
        subject: 'Uniform request (Winter)',
        requester: 'Bilal Ahmed',
        priority: 'low',
        status: 'resolved',
        assignee: 'Inventory',
        updated: '2 days ago',
    },
    {
        id: 'TKT-1022',
        subject: 'Guard missing at Gulberg Br.',
        requester: 'Client: ABC Bank',
        priority: 'critical',
        status: 'in_progress',
        assignee: 'Ops Manager',
        updated: '3 hours ago',
    },
    {
        id: 'TKT-1021',
        subject: 'Password reset required',
        requester: 'Tariq Mehmood',
        priority: 'low',
        status: 'resolved',
        assignee: 'Auto System',
        updated: '3 days ago',
    },
];

export function TicketsTable() {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Recent Tickets</CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        View All
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">ID</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Requester</TableHead>
                            <TableHead>Assignee</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Updated</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tickets.map((ticket) => (
                            <TableRow key={ticket.id}>
                                <TableCell className="font-mono font-medium text-xs">{ticket.id}</TableCell>
                                <TableCell className="font-medium">{ticket.subject}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{ticket.requester}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarFallback className="text-[10px] bg-secondary">
                                                {ticket.assignee.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{ticket.assignee}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className={
                                            ticket.priority === 'critical' ? 'border-destructive text-destructive' :
                                                ticket.priority === 'high' ? 'border-warning text-warning' :
                                                    'text-muted-foreground'
                                        }
                                    >
                                        {ticket.priority}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            ticket.status === 'resolved' ? 'default' :
                                                ticket.status === 'in_progress' ? 'secondary' : 'outline'
                                        }
                                        className="capitalize"
                                    >
                                        {ticket.status.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                    {ticket.updated}
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
                                                <MessageSquare className="h-4 w-4 mr-2" />
                                                Reply
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>Assign To...</DropdownMenuItem>
                                            <DropdownMenuItem>Change Status</DropdownMenuItem>
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
