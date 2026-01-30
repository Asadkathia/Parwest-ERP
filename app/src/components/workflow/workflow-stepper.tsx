import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowStep {
    id: string;
    label: string;
    status: 'completed' | 'current' | 'upcoming';
    timestamp?: string;
}

interface WorkflowStepperProps {
    steps: WorkflowStep[];
    orientation?: 'horizontal' | 'vertical';
    title?: string;
}

export function WorkflowStepper({ steps, orientation = 'horizontal', title }: WorkflowStepperProps) {
    const getStepIcon = (status: WorkflowStep['status']) => {
        switch (status) {
            case 'completed':
                return <Check className="h-4 w-4 text-white" />;
            case 'current':
                return <Clock className="h-4 w-4 text-white" />;
            case 'upcoming':
                return <Circle className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getStepColor = (status: WorkflowStep['status']) => {
        switch (status) {
            case 'completed':
                return 'bg-success';
            case 'current':
                return 'bg-primary';
            case 'upcoming':
                return 'bg-muted border-2 border-muted-foreground/20';
        }
    };

    if (orientation === 'vertical') {
        return (
            <Card className="shadow-sm">
                {title && (
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{title}</CardTitle>
                    </CardHeader>
                )}
                <CardContent>
                    <div className="space-y-4">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', getStepColor(step.status))}>
                                        {getStepIcon(step.status)}
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className={cn('w-0.5 flex-1 mt-2 mb-2', step.status === 'completed' ? 'bg-success' : 'bg-muted')} style={{ minHeight: '24px' }} />
                                    )}
                                </div>
                                <div className="flex-1 pb-4">
                                    <div className="flex items-center gap-2">
                                        <p className={cn('text-sm font-medium', step.status === 'upcoming' && 'text-muted-foreground')}>
                                            {step.label}
                                        </p>
                                        {step.status === 'current' && (
                                            <Badge variant="default" className="text-xs">Current</Badge>
                                        )}
                                    </div>
                                    {step.timestamp && (
                                        <p className="text-xs text-muted-foreground mt-1">{step.timestamp}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-sm">
            {title && (
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
            )}
            <CardContent>
                <div className="flex items-center justify-between">
                    {steps.map((step, index) => (
                        <div key={step.id} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1">
                                <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', getStepColor(step.status))}>
                                    {getStepIcon(step.status)}
                                </div>
                                <p className={cn('text-xs font-medium mt-2 text-center', step.status === 'upcoming' && 'text-muted-foreground')}>
                                    {step.label}
                                </p>
                                {step.timestamp && (
                                    <p className="text-xs text-muted-foreground mt-1">{step.timestamp}</p>
                                )}
                            </div>
                            {index < steps.length - 1 && (
                                <div className={cn('h-0.5 flex-1 -mt-8', step.status === 'completed' ? 'bg-success' : 'bg-muted')} />
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
