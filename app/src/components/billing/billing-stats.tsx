'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, AlertCircle, CheckCircle2, DollarSign } from 'lucide-react';

export function BillingStats() {
    return (
        <div className="grid gap-4 md:grid-cols-4">
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Outstanding
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rs. 4.2M</div>
                    <p className="text-xs text-muted-foreground mt-1">Across 12 invoices</p>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Overdue Amount
                    </CardTitle>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-destructive">Rs. 850k</div>
                    <p className="text-xs text-muted-foreground mt-1">3 invoices &gt; 30 days</p>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Collected (MTD)
                    </CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-success">Rs. 1.8M</div>
                    <p className="text-xs text-muted-foreground mt-1">Feb 2026</p>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Avg. Days to Pay
                    </CardTitle>
                    <CreditCard className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">18 days</div>
                    <p className="text-xs text-muted-foreground mt-1">Last 90 days rolling</p>
                </CardContent>
            </Card>
        </div>
    );
}
