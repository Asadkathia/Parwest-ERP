import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
    title: string;
    value: string | number;
    change?: {
        value: number;
        label: string;
    };
    icon: LucideIcon;
    iconColor?: string;
    trend?: 'up' | 'down' | 'neutral';
}

export function KPICard({ title, value, change, icon: Icon, iconColor = 'text-primary', trend }: KPICardProps) {
    const getTrendColor = () => {
        if (!trend) return '';
        if (trend === 'up') return 'text-success';
        if (trend === 'down') return 'text-destructive';
        return 'text-muted-foreground';
    };

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="text-2xl font-bold">{value}</div>
                        {change && (
                            <p className={cn('text-xs', getTrendColor())}>
                                {change.value > 0 ? '+' : ''}{change.value}% {change.label}
                            </p>
                        )}
                    </div>
                    <Icon className={cn('h-5 w-5', iconColor)} />
                </div>
            </CardContent>
        </Card>
    );
}
