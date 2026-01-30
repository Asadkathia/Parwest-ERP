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
import { MapPin, Users, Sun, Moon, MoreHorizontal, ArrowUpRight, Repeat, XCircle } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SwapGuardDrawer } from './swap-guard-drawer';
import { RevokeDeploymentDialog } from './revoke-deployment-dialog';

// Mock Data
const matrixData = [
    {
        id: '1',
        client: 'ABC Bank Limited',
        branch: 'Gulberg Branch',
        location: 'Gulberg III, Lahore',
        supervisor: 'Ahmed Khan',
        day_shift: { required: 4, assigned: 4 },
        night_shift: { required: 3, assigned: 3 },
        status: 'fully_deployed',
    },
    {
        id: '2',
        client: 'ABC Bank Limited',
        branch: 'Model Town Branch',
        location: 'Model Town, Lahore',
        supervisor: 'Bilal Ahmed',
        day_shift: { required: 2, assigned: 2 },
        night_shift: { required: 2, assigned: 1 }, // Deficit
        status: 'understaffed',
    },
    {
        id: '3',
        client: 'TechFlow Solutions',
        branch: 'HQ - Islamabad',
        location: 'Blue Area, Islamabad',
        supervisor: 'Raza Ali',
        day_shift: { required: 3, assigned: 3 },
        night_shift: { required: 2, assigned: 2 },
        status: 'fully_deployed',
    },
    {
        id: '4',
        client: 'Beaconhouse School',
        branch: 'Garden Town Campus',
        location: 'Garden Town, Lahore',
        supervisor: 'Tariq Mehmood',
        day_shift: { required: 5, assigned: 4 }, // Deficit
        night_shift: { required: 2, assigned: 2 },
        status: 'understaffed',
    },
    {
        id: '5',
        client: 'Metro C&C',
        branch: 'Thokar Niaz Baig',
        location: 'Thokar, Lahore',
        supervisor: 'Imran Siddiqui',
        day_shift: { required: 8, assigned: 8 },
        night_shift: { required: 6, assigned: 6 },
        status: 'fully_deployed',
    },
];

export function DeploymentMatrix() {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Deployment Matrix</CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <ArrowUpRight className="h-4 w-4 mr-2" />
                        View Capacity Report
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Deployment Site</TableHead>
                            <TableHead>Supervisor</TableHead>
                            <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                    <Sun className="h-4 w-4" /> Day Shift
                                </div>
                            </TableHead>
                            <TableHead className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                    <Moon className="h-4 w-4" /> Night Shift
                                </div>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {matrixData.map((site) => {
                            const dayStatus = site.day_shift.assigned >= site.day_shift.required ? 'text-success' : 'text-destructive';
                            const nightStatus = site.night_shift.assigned >= site.night_shift.required ? 'text-success' : 'text-destructive';

                            return (
                                <TableRow key={site.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{site.branch}</span>
                                            <span className="text-xs text-muted-foreground">{site.client}</span>
                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                                                <MapPin className="h-3 w-3" /> {site.location}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                {site.supervisor.charAt(0)}
                                            </div>
                                            <span className="text-sm">{site.supervisor}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`font-mono font-medium ${dayStatus}`}>
                                                {site.day_shift.assigned}/{site.day_shift.required}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground uppercase">Guards</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`font-mono font-medium ${nightStatus}`}>
                                                {site.night_shift.assigned}/{site.night_shift.required}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground uppercase">Guards</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={site.status === 'fully_deployed' ? 'default' : 'destructive'} className="uppercase text-[10px]">
                                            {site.status === 'fully_deployed' ? 'Full' : 'Short'}
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
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                    <SwapGuardDrawer
                                                        trigger={
                                                            <span className="w-full cursor-pointer">Swap Guard</span>
                                                        }
                                                    />
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                    <RevokeDeploymentDialog
                                                        trigger={
                                                            <span className="w-full cursor-pointer">Revoke Deployment</span>
                                                        }
                                                    />
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>View Schedule</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
