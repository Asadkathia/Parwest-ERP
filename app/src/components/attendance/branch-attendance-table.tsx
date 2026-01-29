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
import { MoreHorizontal, ExternalLink } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const branchData = [
    {
        id: '1',
        name: 'Gulberg Branch',
        client: 'ABC Bank Limited',
        scheduled: 24,
        present: 22,
        absent: 0,
        late: 2,
        status: 'completed',
    },
    {
        id: '2',
        name: 'Model Town Branch',
        client: 'ABC Bank Limited',
        scheduled: 18,
        present: 15,
        absent: 1,
        late: 2,
        status: 'issues',
    },
    {
        id: '3',
        name: 'HQ - Islamabad',
        client: 'TechFlow Solutions',
        scheduled: 12,
        present: 12,
        absent: 0,
        late: 0,
        status: 'completed',
    },
    {
        id: '4',
        name: 'Garden Town Campus',
        client: 'Beaconhouse School',
        scheduled: 8,
        present: 6,
        absent: 2,
        late: 0,
        status: 'critical',
    },
    {
        id: '5',
        name: 'Thokar Niaz Baig',
        client: 'Metro C&C',
        scheduled: 32,
        present: 30,
        absent: 0,
        late: 2,
        status: 'completed',
    },
];

export function BranchAttendanceTable() {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Branch Summary</CardTitle>
                <Button variant="outline" size="sm">
                    View Full Report
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Branch Name</TableHead>
                            <TableHead className="text-center">Scheduled</TableHead>
                            <TableHead className="text-center">Present</TableHead>
                            <TableHead className="text-center">Late</TableHead>
                            <TableHead className="text-center">Absent</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {branchData.map((branch) => (
                            <TableRow key={branch.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{branch.name}</span>
                                        <span className="text-xs text-muted-foreground">{branch.client}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center font-mono">{branch.scheduled}</TableCell>
                                <TableCell className="text-center font-mono text-success">{branch.present}</TableCell>
                                <TableCell className="text-center font-mono text-warning">{branch.late}</TableCell>
                                <TableCell className="text-center font-mono text-destructive">{branch.absent}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            branch.status === 'completed' ? 'default' :
                                                branch.status === 'issues' ? 'secondary' : 'destructive'
                                        }
                                        className="capitalize"
                                    >
                                        {branch.status === 'issues' ? 'Attention' : branch.status}
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
                                            <DropdownMenuItem>View Details</DropdownMenuItem>
                                            <DropdownMenuItem>Contact Supervisor</DropdownMenuItem>
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
