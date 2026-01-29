'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Clock, History, AlertTriangle } from 'lucide-react';

export function GuardDeployments() {
    const currentDeployment = {
        branch: 'ABC Bank - Gulberg Branch',
        client: 'ABC Bank Ltd.',
        address: 'Main Boulevard Gulberg III, Lahore',
        shift: 'Day Shift (08:00 - 20:00)',
        role: 'Armed Guard',
        started_at: '2024-01-15',
        deployed_by: 'Ahmed Supervisor',
        status: 'active',
    };

    const history = [
        {
            id: '1',
            branch: 'XYZ Corp HQ',
            client: 'XYZ Corporation',
            role: 'Security Guard',
            start_date: '2023-06-01',
            end_date: '2023-12-31',
            duration: '7 months',
            reason: 'Contract Ended',
            status: 'completed',
        },
        {
            id: '2',
            branch: 'City Mall Parking',
            client: 'City Mall Management',
            role: 'Traffic Marshall',
            start_date: '2023-01-10',
            end_date: '2023-05-30',
            duration: '5 months',
            reason: 'Transferred',
            status: 'completed',
        },
    ];

    return (
        <div className="space-y-8">
            {/* Current Deployment */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Active Deployment
                    </h3>
                    <Button variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/5">
                        Revoke Deployment
                    </Button>
                </div>

                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-xl font-bold text-primary">{currentDeployment.branch}</h4>
                                    <p className="text-muted-foreground">{currentDeployment.client}</p>
                                </div>
                                <div className="flex items-start gap-2 text-sm">
                                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                                    <span>{currentDeployment.address}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-background rounded-lg border shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <Clock className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Shift</p>
                                            <p className="text-xs text-muted-foreground">{currentDeployment.shift}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-background rounded-lg border shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <Calendar className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Deployed Since</p>
                                            <p className="text-xs text-muted-foreground">{currentDeployment.started_at}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Deployment History */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    Deployment History
                </h3>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>End Reason</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="font-medium">{item.branch}</div>
                                            <div className="text-xs text-muted-foreground">{item.client}</div>
                                        </TableCell>
                                        <TableCell>{item.role}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {item.start_date} <span className="text-muted-foreground">to</span> {item.end_date}
                                            </div>
                                        </TableCell>
                                        <TableCell>{item.duration}</TableCell>
                                        <TableCell>{item.reason}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
