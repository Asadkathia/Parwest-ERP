'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowStepper, WorkflowStep } from '@/components/workflow/workflow-stepper';
import { WorkflowActions, WorkflowTransition } from '@/components/workflow/workflow-actions';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, XCircle, CheckCircle2 } from 'lucide-react';

// Mock deployment workflow data
const deploymentWorkflow: Record<string, WorkflowStep[]> = {
    planned: [
        { id: '1', label: 'Planned', status: 'current' },
        { id: '2', label: 'Active', status: 'upcoming' },
        { id: '3', label: 'Ended', status: 'upcoming' },
    ],
    active: [
        { id: '1', label: 'Planned', status: 'completed', timestamp: 'Jan 10, 2026' },
        { id: '2', label: 'Active', status: 'current', timestamp: 'Jan 15, 2026' },
        { id: '3', label: 'Ended', status: 'upcoming' },
    ],
    suspended: [
        { id: '1', label: 'Planned', status: 'completed', timestamp: 'Jan 10, 2026' },
        { id: '2', label: 'Active', status: 'completed', timestamp: 'Jan 15, 2026' },
        { id: '3', label: 'Suspended', status: 'current', timestamp: 'Jan 28, 2026' },
        { id: '4', label: 'Ended', status: 'upcoming' },
    ],
};

const workflowTransitions: WorkflowTransition[] = [
    {
        id: 'activate',
        label: 'Activate Deployment',
        fromStatus: 'planned',
        toStatus: 'active',
        icon: Play,
        variant: 'default',
        validationHint: 'Ensure all guards are assigned and verified',
    },
    {
        id: 'suspend',
        label: 'Suspend Deployment',
        fromStatus: 'active',
        toStatus: 'suspended',
        icon: Pause,
        variant: 'secondary',
        requiresApproval: true,
        validationHint: 'Provide reason for suspension',
    },
    {
        id: 'end',
        label: 'End Deployment',
        fromStatus: 'active',
        toStatus: 'ended',
        icon: CheckCircle2,
        variant: 'outline',
        validationHint: 'Complete final attendance and settlement',
    },
    {
        id: 'revoke',
        label: 'Revoke Deployment',
        fromStatus: 'active',
        toStatus: 'revoked',
        icon: XCircle,
        variant: 'destructive',
        requiresApproval: true,
        validationHint: 'Settlement must be processed',
    },
    {
        id: 'reactivate',
        label: 'Reactivate Deployment',
        fromStatus: 'suspended',
        toStatus: 'active',
        icon: Play,
        variant: 'default',
        validationHint: 'Verify guards are available',
    },
];

interface DeploymentWorkflowPanelProps {
    deploymentId: string;
    currentStatus?: 'planned' | 'active' | 'suspended' | 'ended' | 'revoked';
}

export function DeploymentWorkflowPanel({ deploymentId, currentStatus = 'active' }: DeploymentWorkflowPanelProps) {
    const { toast } = useToast();
    const steps = deploymentWorkflow[currentStatus] || deploymentWorkflow.active;

    const handleTransition = (transition: WorkflowTransition) => {
        toast({
            title: 'Deployment Status Change',
            description: `Deployment will be changed to: ${transition.toStatus}`,
        });
    };

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Deployment Workflow</CardTitle>
                    <Badge variant="default">{currentStatus}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Workflow Stepper */}
                <WorkflowStepper steps={steps} orientation="horizontal" />

                {/* Available Actions */}
                <div className="pt-2">
                    <p className="text-sm font-medium mb-3">Available Actions:</p>
                    <div className="space-y-2">
                        {workflowTransitions
                            .filter(t => t.fromStatus === currentStatus)
                            .map((transition) => {
                                const Icon = transition.icon || Play;
                                return (
                                    <div key={transition.id} className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleTransition(transition)}
                                            className="text-sm text-primary hover:underline flex items-center gap-1"
                                        >
                                            <Icon className="h-3 w-3" />
                                            {transition.label}
                                        </button>
                                        {transition.requiresApproval && (
                                            <Badge variant="outline" className="text-xs">Requires Approval</Badge>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
