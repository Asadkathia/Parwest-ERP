'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Send,
    Bell,
    Users,
    MapPin,
    Shield,
    AlertCircle,
    Info,
    CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Mock past broadcasts
const pastBroadcasts = [
    {
        id: 'BC-2026-001',
        title: 'January Payroll Processing',
        message: 'Payroll for January 2026 has been processed. Please check your accounts.',
        audience: 'All Staff',
        priority: 'normal',
        sentBy: 'Sara Malik',
        sentDate: '2026-01-30T10:00:00',
        recipients: 245,
    },
    {
        id: 'BC-2026-002',
        title: 'Emergency Deployment Alert',
        message: 'Urgent: Need 5 guards for emergency deployment at Metro Mall.',
        audience: 'Operations Team',
        priority: 'high',
        sentBy: 'Bilal Ahmed',
        sentDate: '2026-01-29T14:30:00',
        recipients: 12,
    },
    {
        id: 'BC-2026-003',
        title: 'Training Session Reminder',
        message: 'Mandatory security training session on Feb 5, 2026 at 9:00 AM.',
        audience: 'All Guards',
        priority: 'normal',
        sentBy: 'Ahmed Khan',
        sentDate: '2026-01-28T09:00:00',
        recipients: 180,
    },
    {
        id: 'BC-2026-004',
        title: 'System Maintenance Notice',
        message: 'ERP system will be under maintenance on Feb 1, 2026 from 2:00 AM to 6:00 AM.',
        audience: 'Organization Wide',
        priority: 'low',
        sentBy: 'Admin',
        sentDate: '2026-01-27T16:00:00',
        recipients: 312,
    },
];

export default function BroadcastNotificationsPage() {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [audience, setAudience] = useState('');
    const [priority, setPriority] = useState('normal');
    const { toast } = useToast();

    const handleSendBroadcast = () => {
        if (!title || !message || !audience) {
            toast({
                title: 'Validation Error',
                description: 'Please fill in all required fields',
                variant: 'destructive',
            });
            return;
        }

        toast({
            title: 'Broadcast Sent',
            description: `Notification sent to ${audience}`,
        });

        // Reset form
        setTitle('');
        setMessage('');
        setAudience('');
        setPriority('normal');
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'high':
                return (
                    <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        High
                    </Badge>
                );
            case 'normal':
                return (
                    <Badge variant="secondary" className="text-xs">
                        <Info className="h-3 w-3 mr-1" />
                        Normal
                    </Badge>
                );
            case 'low':
                return (
                    <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Low
                    </Badge>
                );
            default:
                return null;
        }
    };

    const getAudienceIcon = (audience: string) => {
        if (audience.includes('Organization')) return <Users className="h-4 w-4" />;
        if (audience.includes('Guards')) return <Shield className="h-4 w-4" />;
        if (audience.includes('Region')) return <MapPin className="h-4 w-4" />;
        return <Bell className="h-4 w-4" />;
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Broadcast Notifications"
                description="Send notifications to staff members"
                breadcrumbs={[{ label: 'Notifications' }, { label: 'Broadcast' }]}
            />

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Broadcast Form */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Create Broadcast</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title">
                                Title <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="title"
                                placeholder="Enter notification title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        {/* Message */}
                        <div className="space-y-2">
                            <Label htmlFor="message">
                                Message <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="message"
                                placeholder="Enter notification message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                            />
                            <p className="text-xs text-muted-foreground">
                                {message.length} / 500 characters
                            </p>
                        </div>

                        {/* Audience */}
                        <div className="space-y-2">
                            <Label htmlFor="audience">
                                Audience <span className="text-destructive">*</span>
                            </Label>
                            <Select value={audience} onValueChange={setAudience}>
                                <SelectTrigger id="audience">
                                    <SelectValue placeholder="Select audience" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="organization">Organization Wide</SelectItem>
                                    <SelectItem value="guards">All Guards</SelectItem>
                                    <SelectItem value="supervisors">All Supervisors</SelectItem>
                                    <SelectItem value="managers">All Managers</SelectItem>
                                    <SelectItem value="hr">HR Department</SelectItem>
                                    <SelectItem value="finance">Finance Department</SelectItem>
                                    <SelectItem value="operations">Operations Team</SelectItem>
                                    <SelectItem value="region-lahore">Region: Lahore</SelectItem>
                                    <SelectItem value="region-islamabad">Region: Islamabad</SelectItem>
                                    <SelectItem value="region-karachi">Region: Karachi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Priority */}
                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger id="priority">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="high">High Priority</SelectItem>
                                    <SelectItem value="normal">Normal Priority</SelectItem>
                                    <SelectItem value="low">Low Priority</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator />

                        {/* Send Button */}
                        <Button onClick={handleSendBroadcast} className="w-full">
                            <Send className="h-4 w-4 mr-2" />
                            Send Broadcast
                        </Button>
                    </CardContent>
                </Card>

                {/* Preview Card */}
                <Card className="shadow-sm border-dashed">
                    <CardHeader>
                        <CardTitle className="text-base">Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {title || message || audience ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
                                    <Bell className="h-5 w-5 text-primary mt-0.5" />
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold">
                                                {title || 'Notification Title'}
                                            </h4>
                                            {getPriorityBadge(priority)}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {message || 'Your notification message will appear here...'}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                                            {audience && getAudienceIcon(audience)}
                                            <span>{audience || 'Select audience'}</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    This is how your notification will appear to recipients
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                <p className="text-sm text-muted-foreground">
                                    Fill in the form to preview your broadcast
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Past Broadcasts */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Broadcast History</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Audience</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Sent By</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Recipients</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pastBroadcasts.map((broadcast) => (
                                <TableRow key={broadcast.id}>
                                    <TableCell className="font-mono text-sm">
                                        {broadcast.id}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{broadcast.title}</span>
                                            <span className="text-xs text-muted-foreground line-clamp-1">
                                                {broadcast.message}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getAudienceIcon(broadcast.audience)}
                                            <span className="text-sm">{broadcast.audience}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{getPriorityBadge(broadcast.priority)}</TableCell>
                                    <TableCell className="text-sm">{broadcast.sentBy}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(broadcast.sentDate).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {broadcast.recipients}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
