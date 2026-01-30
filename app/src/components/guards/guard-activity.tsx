'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    UserPlus,
    MapPin,
    FileText,
    DollarSign,
    Calendar,
    CheckCircle2,
    Edit,
    AlertCircle
} from 'lucide-react';

// Mock activity data
const activities = [
    {
        id: '1',
        type: 'payroll',
        title: 'Payroll Processed',
        description: 'January 2026 salary disbursed - Rs. 40,500',
        timestamp: '2026-01-29 10:30 AM',
        user: 'System',
        icon: DollarSign,
        color: 'text-success',
    },
    {
        id: '2',
        type: 'attendance',
        title: 'Attendance Marked',
        description: 'Present at ABC Bank - Gulberg Branch',
        timestamp: '2026-01-29 08:00 AM',
        user: 'Auto-marked',
        icon: CheckCircle2,
        color: 'text-success',
    },
    {
        id: '3',
        type: 'document',
        title: 'Document Uploaded',
        description: 'Medical Certificate added to case file',
        timestamp: '2026-01-25 02:15 PM',
        user: 'HR Manager',
        icon: FileText,
        color: 'text-blue-500',
    },
    {
        id: '4',
        type: 'attendance',
        title: 'Leave Approved',
        description: 'Sick leave for 1 day approved',
        timestamp: '2026-01-23 09:00 AM',
        user: 'Operations Manager',
        icon: Calendar,
        color: 'text-warning',
    },
    {
        id: '5',
        type: 'deployment',
        title: 'Deployment Updated',
        description: 'Shift changed to Morning (8 AM - 8 PM)',
        timestamp: '2026-01-15 11:20 AM',
        user: 'Operations Manager',
        icon: MapPin,
        color: 'text-purple-500',
    },
    {
        id: '6',
        type: 'profile',
        title: 'Profile Updated',
        description: 'Contact number updated',
        timestamp: '2026-01-10 03:45 PM',
        user: 'HR Manager',
        icon: Edit,
        color: 'text-muted-foreground',
    },
    {
        id: '7',
        type: 'payroll',
        title: 'Loan Disbursed',
        description: 'Emergency loan of Rs. 20,000 approved',
        timestamp: '2025-11-01 10:00 AM',
        user: 'Finance Manager',
        icon: DollarSign,
        color: 'text-success',
    },
    {
        id: '8',
        type: 'attendance',
        title: 'Attendance Alert',
        description: 'Marked absent - unauthorized',
        timestamp: '2025-10-15 08:30 AM',
        user: 'System',
        icon: AlertCircle,
        color: 'text-destructive',
    },
    {
        id: '9',
        type: 'deployment',
        title: 'Deployed to Client',
        description: 'Assigned to ABC Bank - Gulberg Branch',
        timestamp: '2024-02-01 09:00 AM',
        user: 'Operations Manager',
        icon: MapPin,
        color: 'text-purple-500',
    },
    {
        id: '10',
        type: 'profile',
        title: 'Guard Onboarded',
        description: 'Profile created and verification initiated',
        timestamp: '2024-01-15 10:00 AM',
        user: 'HR Manager',
        icon: UserPlus,
        color: 'text-blue-500',
    },
];

export function GuardActivity() {
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative space-y-4">
                    {/* Timeline line */}
                    <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-border" />

                    {activities.map((activity, index) => {
                        const Icon = activity.icon;
                        return (
                            <div key={activity.id} className="relative flex gap-4">
                                {/* Icon */}
                                <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm`}>
                                    <Icon className={`h-5 w-5 ${activity.color}`} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 pb-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1">
                                            <p className="font-medium leading-none">{activity.title}</p>
                                            <p className="text-sm text-muted-foreground">{activity.description}</p>
                                        </div>
                                        <Badge variant="outline" className="shrink-0 capitalize">
                                            {activity.type}
                                        </Badge>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        <span>{activity.timestamp}</span>
                                        <span>•</span>
                                        <span>by {activity.user}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
