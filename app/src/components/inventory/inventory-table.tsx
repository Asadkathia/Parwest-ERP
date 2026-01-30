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
import { MoreHorizontal, Box, QrCode } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock Inventory Data
const assets = [
    {
        id: 'AST-0015',
        name: 'Glock 17c - 9mm',
        category: 'Weapon',
        serial: 'G1755921',
        status: 'deployed',
        assigned_to: 'Ali Hassan',
        location: 'Gulberg Branch',
    },
    {
        id: 'AST-0016',
        name: 'Pump Action 12G',
        category: 'Weapon',
        serial: 'PA9921',
        status: 'available',
        assigned_to: '-',
        location: 'HQ Armory',
    },
    {
        id: 'AST-0018',
        name: 'Motorola Walkie Talkie',
        category: 'Communication',
        serial: 'MT8821',
        status: 'deployed',
        assigned_to: 'Usman Ali',
        location: 'Model Town Branch',
    },
    {
        id: 'AST-0022',
        name: 'Winter Jacket (L)',
        category: 'Uniform',
        serial: 'WJ-L-99',
        status: 'maintenance',
        assigned_to: '-',
        location: 'HQ Tailor',
    },
    {
        id: 'AST-0030',
        name: 'Metal Detector Wand',
        category: 'Equipment',
        serial: 'MDW-221',
        status: 'deployed',
        assigned_to: 'Bilal Ahmed',
        location: 'Gulberg Branch',
    },
];

export function InventoryTable() {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Asset Inventory</CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <QrCode className="h-4 w-4 mr-2" />
                        Scan Asset
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Asset ID</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Serial #</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assets.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-mono font-medium text-xs">{item.id}</TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="font-normal">
                                        {item.category}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{item.serial}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            item.status === 'available' ? 'default' :
                                                item.status === 'deployed' ? 'secondary' :
                                                    item.status === 'maintenance' ? 'destructive' : 'outline'
                                        }
                                        className="capitalize"
                                    >
                                        {item.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{item.assigned_to}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{item.location}</TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem>View History</DropdownMenuItem>
                                            <DropdownMenuItem>Transfer Asset</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive">Mark Lost</DropdownMenuItem>
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
