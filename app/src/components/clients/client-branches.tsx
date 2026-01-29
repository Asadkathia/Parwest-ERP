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
import { Plus, MapPin, MoreHorizontal } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock Branches Data
const branches = [
    {
        id: '1',
        name: 'Main Branch Gulberg',
        location: 'Gulberg III, Lahore',
        city: 'Lahore',
        guards: 12,
        supervisor: 'Ahmed Khan',
        status: 'active',
        contact: '042-1234567'
    },
    {
        id: '2',
        name: 'DHA Phase 5 Branch',
        location: 'Sector C, DHA Ph5, Lahore',
        city: 'Lahore',
        guards: 8,
        supervisor: 'Raza Ali',
        status: 'active',
        contact: '042-7654321'
    },
    {
        id: '3',
        name: 'Johar Town Branch',
        location: 'G-1 Market, Johar Town',
        city: 'Lahore',
        guards: 6,
        supervisor: 'Tariq Mehmood',
        status: 'inactive',
        contact: '042-9988776'
    },
    {
        id: '4',
        name: 'Model Town Branch',
        location: 'C-Block Market, Model Town',
        city: 'Lahore',
        guards: 10,
        supervisor: 'Bilal Ahmed',
        status: 'active',
        contact: '042-5544332'
    }
];

export function ClientBranches() {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Deployed Locations (Sites)</CardTitle>
                <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Branch
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Branch Name</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Supervisor</TableHead>
                            <TableHead className="text-center">Guards</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {branches.map((branch) => (
                            <TableRow key={branch.id}>
                                <TableCell className="font-medium">
                                    {branch.name}
                                    <div className="text-xs text-muted-foreground mt-0.5">{branch.contact}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                                        <MapPin className="h-3 w-3" />
                                        {branch.location}
                                    </div>
                                </TableCell>
                                <TableCell>{branch.supervisor}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="secondary" className="font-mono">{branch.guards}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={branch.status === 'active' ? 'default' : 'secondary'}>
                                        {branch.status === 'active' ? 'Active' : 'Inactive'}
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
                                            <DropdownMenuItem>View Schedule</DropdownMenuItem>
                                            <DropdownMenuItem>Guard List</DropdownMenuItem>
                                            <DropdownMenuItem>Edit Details</DropdownMenuItem>
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
