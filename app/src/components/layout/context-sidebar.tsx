'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ContextCard {
    title: string;
    children: React.ReactNode;
    className?: string;
}

interface ContextSidebarProps {
    cards?: ContextCard[];
    children?: React.ReactNode;
    className?: string;
}

export function ContextSidebar({ cards, children, className }: ContextSidebarProps) {
    return (
        <aside
            className={cn(
                'hidden xl:block w-80 shrink-0 border-l border-border bg-muted/30',
                className
            )}
        >
            <ScrollArea className="h-[calc(100vh-4rem)]">
                <div className="p-4 space-y-4">
                    {cards?.map((card, index) => (
                        <Card key={index} className={cn('shadow-sm', card.className)}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            </CardHeader>
                            <CardContent>{card.children}</CardContent>
                        </Card>
                    ))}
                    {children}
                </div>
            </ScrollArea>
        </aside>
    );
}

// Quick Stats Card for Context Sidebar
interface QuickStatProps {
    label: string;
    value: string | number;
    change?: {
        value: number;
        type: 'increase' | 'decrease' | 'neutral';
    };
}

export function QuickStat({ label, value, change }: QuickStatProps) {
    return (
        <div className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
                <span className="font-medium">{value}</span>
                {change && (
                    <span
                        className={cn(
                            'text-xs',
                            change.type === 'increase' && 'text-success',
                            change.type === 'decrease' && 'text-destructive',
                            change.type === 'neutral' && 'text-muted-foreground'
                        )}
                    >
                        {change.type === 'increase' ? '+' : change.type === 'decrease' ? '-' : ''}
                        {change.value}%
                    </span>
                )}
            </div>
        </div>
    );
}

// Alert List for Context Sidebar
interface AlertItemProps {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    onClick?: () => void;
}

export function AlertItem({ title, description, severity, onClick }: AlertItemProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full text-left rounded-lg p-3 transition-colors hover:bg-muted',
                severity === 'critical' && 'border-l-4 border-destructive',
                severity === 'high' && 'border-l-4 border-warning',
                severity === 'medium' && 'border-l-4 border-info',
                severity === 'low' && 'border-l-4 border-muted-foreground'
            )}
        >
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </button>
    );
}
