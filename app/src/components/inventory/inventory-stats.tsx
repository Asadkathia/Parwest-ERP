'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Truck, Wrench, AlertTriangle } from 'lucide-react';

export function InventoryStats() {
    return (
        <div className="grid gap-4 md:grid-cols-4">
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Assets
                    </CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">1,842</div>
                    <p className="text-xs text-muted-foreground mt-1">Value: Rs. 4.5M</p>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Issued / Deployed
                    </CardTitle>
                    <Truck className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-success">1,450</div>
                    <p className="text-xs text-muted-foreground mt-1">78% utilization</p>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        In Maintenance
                    </CardTitle>
                    <Wrench className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-warning">24</div>
                    <p className="text-xs text-muted-foreground mt-1">Repair pending</p>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Lost / Retired
                    </CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-destructive">12</div>
                    <p className="text-xs text-muted-foreground mt-1">This year</p>
                </CardContent>
            </Card>
        </div>
    );
}
