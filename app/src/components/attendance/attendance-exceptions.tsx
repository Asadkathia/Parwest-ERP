'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, X, Clock } from 'lucide-react';

const exceptions = [
    {
        id: '1',
        name: 'Ali Hassan',
        type: 'absent',
        branch: 'Garden Town Campus',
        time: '08:00 AM', // Shift start
        status: 'pending',
    },
    {
        id: '2',
        name: 'Usman Ali',
        type: 'late',
        branch: 'Main Branch Gulberg',
        time: '08:45 AM', // Actual arrival
        late_by: '45m',
        status: 'pending',
    },
    {
        id: '3',
        name: 'Kamran Khan',
        type: 'absent',
        branch: 'Garden Town Campus',
        time: '08:00 AM',
        status: 'resolved',
    },
    {
        id: '4',
        name: 'Bilal Ahmed',
        type: 'late',
        branch: 'Model Town Branch',
        time: '08:15 AM',
        late_by: '15m',
        status: 'pending',
    },
];

export function AttendanceExceptions() {
    return (
        <Card className="shadow-sm h-full">
            <CardHeader>
                <CardTitle className="text-base font-medium">Daily Exceptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {exceptions.map((item) => (
                    <div key={item.id} className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                                <AvatarFallback className={item.type === 'absent' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}>
                                    {item.name.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                                <p className="text-sm font-medium leading-none">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.branch}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${item.type === 'absent' ? 'text-destructive border-destructive/20' : 'text-warning border-warning/20'}`}>
                                        {item.type === 'absent' ? 'Absent' : `Late (${item.late_by})`}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">{item.time}</span>
                                </div>
                            </div>
                        </div>
                        {item.status === 'pending' && (
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-success">
                                    <Check className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                ))}

                <Button variant="ghost" className="w-full text-xs mt-2">
                    View All Exceptions
                </Button>
            </CardContent>
        </Card>
    );
}
