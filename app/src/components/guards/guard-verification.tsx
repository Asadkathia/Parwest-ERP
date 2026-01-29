'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function GuardVerification() {
    const verifications = [
        {
            title: 'NADRA Verification',
            description: 'CNIC authenticity check via NADRA portal',
            status: 'verified',
            date: '2024-01-15',
            verified_by: 'System Admin',
            remarks: 'Bio-metric match confirmed',
        },
        {
            title: 'Police Verification',
            description: 'Criminal record check from local police station',
            status: 'verified',
            date: '2024-01-20',
            verified_by: 'Security Manager',
            remarks: 'Clear record, certificate attached',
        },
        {
            title: 'Reference Check 1',
            description: 'Previous employer verification',
            status: 'verified',
            date: '2024-01-18',
            verified_by: 'HR Officer',
            remarks: 'Positive feedback from Supervisor at Allied Security',
        },
        {
            title: 'Reference Check 2',
            description: 'Personal reference verification',
            status: 'pending',
            date: null,
            verified_by: null,
            remarks: 'Call scheduled for tomorrow',
        },
        {
            title: 'Home Address Verification',
            description: 'Physical visit to permanent address',
            status: 'failed',
            date: '2024-01-22',
            verified_by: 'Field Officer',
            remarks: 'Address not found, applicant promised to provide updated location map',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Background Check</h3>
                    <p className="text-sm text-muted-foreground">Overall verification status: <span className="text-warning font-medium">In Progress</span></p>
                </div>
                <Button>Initiate New Check</Button>
            </div>

            <div className="grid gap-4">
                {verifications.map((item, index) => (
                    <Card key={index} className="shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    {item.status === 'verified' && <CheckCircle2 className="h-5 w-5 text-success" />}
                                    {item.status === 'pending' && <Clock className="h-5 w-5 text-warning" />}
                                    {item.status === 'failed' && <XCircle className="h-5 w-5 text-destructive" />}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <p className="font-medium">{item.title}</p>
                                        <Badge
                                            variant="outline"
                                            className={
                                                item.status === 'verified' ? 'border-success/20 text-success bg-success/5' :
                                                    item.status === 'pending' ? 'border-warning/20 text-warning bg-warning/5' :
                                                        'border-destructive/20 text-destructive bg-destructive/5'
                                            }
                                        >
                                            {item.status === 'verified' ? 'Verified' : item.status === 'pending' ? 'Pending' : 'Failed'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{item.description}</p>

                                    {item.date && (
                                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                                            <span>Date: {item.date}</span>
                                            <span>Verified By: {item.verified_by}</span>
                                        </div>
                                    )}

                                    {item.remarks && (
                                        <div className="mt-2 rounded bg-muted/50 p-2 text-sm">
                                            <span className="font-medium text-xs text-muted-foreground uppercase tracking-wider block mb-1">Remarks</span>
                                            {item.remarks}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
