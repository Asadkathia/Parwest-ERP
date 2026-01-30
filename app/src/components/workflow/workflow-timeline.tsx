import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User } from 'lucide-react';

export interface TimelineEvent {
    id: string;
    status: string;
    timestamp: string;
    user?: string;
    note?: string;
}

interface WorkflowTimelineProps {
    events: TimelineEvent[];
    title?: string;
}

export function WorkflowTimeline({ events, title = 'Status History' }: WorkflowTimelineProps) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {events.map((event, index) => (
                        <div key={event.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                    <Clock className="h-4 w-4 text-primary" />
                                </div>
                                {index < events.length - 1 && (
                                    <div className="w-0.5 flex-1 bg-muted mt-2" style={{ minHeight: '24px' }} />
                                )}
                            </div>
                            <div className="flex-1 pb-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">
                                        {event.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                                </div>
                                {event.user && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        <span>{event.user}</span>
                                    </div>
                                )}
                                {event.note && (
                                    <p className="text-xs text-muted-foreground mt-1">{event.note}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
