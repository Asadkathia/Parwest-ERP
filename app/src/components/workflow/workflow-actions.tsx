import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, AlertCircle, Info } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface WorkflowTransition {
    id: string;
    label: string;
    fromStatus: string;
    toStatus: string;
    icon?: LucideIcon;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary';
    requiresApproval?: boolean;
    validationHint?: string;
    disabled?: boolean;
}

interface WorkflowActionsProps {
    currentStatus: string;
    transitions: WorkflowTransition[];
    onTransition?: (transition: WorkflowTransition) => void;
    title?: string;
}

export function WorkflowActions({ currentStatus, transitions, onTransition, title = 'Available Actions' }: WorkflowActionsProps) {
    const availableTransitions = transitions.filter(t => t.fromStatus === currentStatus);

    if (availableTransitions.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No actions available for current status
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {availableTransitions.map((transition) => {
                    const Icon = transition.icon || ArrowRight;
                    return (
                        <div key={transition.id} className="space-y-2">
                            <Button
                                variant={transition.variant || 'default'}
                                className="w-full justify-start"
                                disabled={transition.disabled}
                                onClick={() => onTransition?.(transition)}
                            >
                                <Icon className="h-4 w-4 mr-2" />
                                {transition.label}
                            </Button>
                            {transition.validationHint && (
                                <div className="flex items-start gap-2 px-3 py-2 bg-muted/50 rounded-md">
                                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <p className="text-xs text-muted-foreground">{transition.validationHint}</p>
                                </div>
                            )}
                            {transition.requiresApproval && (
                                <div className="flex items-center gap-2 px-3">
                                    <AlertCircle className="h-3 w-3 text-warning" />
                                    <p className="text-xs text-muted-foreground">Requires approval</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
