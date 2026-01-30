import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Alert {
    id: string;
    title: string;
    message: string;
    severity: 'critical' | 'warning' | 'info';
    timestamp?: string;
}

interface AlertListProps {
    alerts: Alert[];
    title?: string;
}

export function AlertList({ alerts, title = 'Alerts & Notifications' }: AlertListProps) {
    const getSeverityIcon = (severity: Alert['severity']) => {
        switch (severity) {
            case 'critical':
                return <AlertCircle className="h-4 w-4 text-destructive" />;
            case 'warning':
                return <AlertTriangle className="h-4 w-4 text-warning" />;
            case 'info':
                return <Info className="h-4 w-4 text-primary" />;
        }
    };

    const getSeverityBadge = (severity: Alert['severity']) => {
        switch (severity) {
            case 'critical':
                return <Badge variant="destructive" className="text-xs">Critical</Badge>;
            case 'warning':
                return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 text-xs">Warning</Badge>;
            case 'info':
                return <Badge variant="outline" className="text-xs">Info</Badge>;
        }
    };

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {alerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No alerts at this time
                    </p>
                ) : (
                    <div className="space-y-3">
                        {alerts.map((alert) => (
                            <div
                                key={alert.id}
                                className={cn(
                                    'flex items-start gap-3 p-3 rounded-lg border',
                                    alert.severity === 'critical' && 'bg-destructive/5 border-destructive/20',
                                    alert.severity === 'warning' && 'bg-warning/5 border-warning/20',
                                    alert.severity === 'info' && 'bg-muted/50'
                                )}
                            >
                                {getSeverityIcon(alert.severity)}
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-medium">{alert.title}</p>
                                        {getSeverityBadge(alert.severity)}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                                    {alert.timestamp && (
                                        <p className="text-xs text-muted-foreground/70">{alert.timestamp}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
