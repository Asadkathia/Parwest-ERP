'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, XCircle, Clock, Coffee } from 'lucide-react';

// Mock attendance data
const attendanceSummary = {
    present: 24,
    absent: 2,
    late: 3,
    leave: 1,
    total: 30,
};

const attendanceRecords = [
    { date: '2026-01-29', status: 'present', checkIn: '08:00 AM', checkOut: '08:00 PM', location: 'ABC Bank - Gulberg' },
    { date: '2026-01-28', status: 'present', checkIn: '08:05 AM', checkOut: '08:00 PM', location: 'ABC Bank - Gulberg' },
    { date: '2026-01-27', status: 'late', checkIn: '08:25 AM', checkOut: '08:00 PM', location: 'ABC Bank - Gulberg' },
    { date: '2026-01-26', status: 'present', checkIn: '07:55 AM', checkOut: '08:05 PM', location: 'ABC Bank - Gulberg' },
    { date: '2026-01-25', status: 'absent', checkIn: '-', checkOut: '-', location: '-' },
    { date: '2026-01-24', status: 'present', checkIn: '08:00 AM', checkOut: '08:00 PM', location: 'ABC Bank - Gulberg' },
    { date: '2026-01-23', status: 'leave', checkIn: '-', checkOut: '-', location: 'Approved Leave' },
    { date: '2026-01-22', status: 'present', checkIn: '08:00 AM', checkOut: '08:00 PM', location: 'ABC Bank - Gulberg' },
];

export function GuardAttendance() {
    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Days
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{attendanceSummary.total}</div>
                        <p className="text-xs text-muted-foreground mt-1">This month</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Present
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-success">{attendanceSummary.present}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {Math.round((attendanceSummary.present / attendanceSummary.total) * 100)}% rate
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Absent
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{attendanceSummary.absent}</div>
                        <p className="text-xs text-muted-foreground mt-1">Unauthorized</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Late Arrivals
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-warning">{attendanceSummary.late}</div>
                        <p className="text-xs text-muted-foreground mt-1">&gt; 15 min late</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Leave Days
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{attendanceSummary.leave}</div>
                        <p className="text-xs text-muted-foreground mt-1">Approved</p>
                    </CardContent>
                </Card>
            </div>

            {/* Attendance Log */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Attendance Log - January 2026</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Check-in</TableHead>
                                <TableHead>Check-out</TableHead>
                                <TableHead>Location</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attendanceRecords.map((record) => (
                                <TableRow key={record.date}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            {record.date}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                record.status === 'present' ? 'default' :
                                                    record.status === 'absent' ? 'destructive' :
                                                        record.status === 'late' ? 'secondary' :
                                                            'outline'
                                            }
                                            className="capitalize"
                                        >
                                            {record.status === 'present' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                            {record.status === 'absent' && <XCircle className="h-3 w-3 mr-1" />}
                                            {record.status === 'late' && <Clock className="h-3 w-3 mr-1" />}
                                            {record.status === 'leave' && <Coffee className="h-3 w-3 mr-1" />}
                                            {record.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">{record.checkIn}</TableCell>
                                    <TableCell className="text-sm">{record.checkOut}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{record.location}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
