'use client';

import { WorkflowStepper, WorkflowStep } from '@/components/workflow/workflow-stepper';
import { WorkflowActions, WorkflowTransition } from '@/components/workflow/workflow-actions';
import { WorkflowTimeline, TimelineEvent } from '@/components/workflow/workflow-timeline';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Pause, UserCheck } from 'lucide-react';

// Mock data for guard workflow
const workflowSteps: WorkflowStep[] = [
    { id: '1', label: 'Draft', status: 'completed', timestamp: 'Jan 15, 2026' },
    { id: '2', label: 'Pending Verification', status: 'completed', timestamp: 'Jan 18, 2026' },
    { id: '3', label: 'Active', status: 'current', timestamp: 'Jan 22, 2026' },
    { id: '4', label: 'Suspended', status: 'upcoming' },
    { id: '5', label: 'Terminated', status: 'upcoming' },
];

const workflowTransitions: WorkflowTransition[] = [
    {
        id: 'suspend',
        label: 'Suspend Guard',
        fromStatus: 'active',
        toStatus: 'suspended',
        icon: Pause,
        variant: 'secondary',
        requiresApproval: true,
        validationHint: 'Provide reason for suspension',
    },
    {
        id: 'terminate',
        label: 'Terminate Guard',
        fromStatus: 'active',
        toStatus: 'terminated',
        icon: XCircle,
        variant: 'destructive',
        requiresApproval: true,
        validationHint: 'Clearance process must be completed first',
    },
    {
        id: 'reactivate',
        label: 'Reactivate Guard',
        fromStatus: 'suspended',
        toStatus: 'active',
        icon: CheckCircle2,
        variant: 'default',
        validationHint: 'Verify guard is ready to resume duties',
    },
];

const timelineEvents: TimelineEvent[] = [
    {
        id: '1',
        status: 'Active',
        timestamp: 'Jan 22, 2026 10:30 AM',
        user: 'Ahmed Khan (HR Manager)',
        note: 'All verification checks completed',
    },
    {
        id: '2',
        status: 'Pending Verification',
        timestamp: 'Jan 18, 2026 2:15 PM',
        user: 'Sara Malik (HR)',
        note: 'Police verification submitted',
    },
    {
        id: '3',
        status: 'Draft',
        timestamp: 'Jan 15, 2026 9:00 AM',
        user: 'Ahmed Khan (HR Manager)',
        note: 'Guard enrollment initiated',
    },
];

export function GuardWorkflow() {
    const { toast } = useToast();
    const currentStatus = 'active';

    const handleTransition = (transition: WorkflowTransition) => {
        toast({
            title: 'Workflow Transition',
            description: `Guard status will be changed to: ${transition.toStatus}`,
        });
    };

    return (
        <div className="space-y-6">
            {/* Workflow Stepper */}
            <WorkflowStepper steps={workflowSteps} title="Guard Status Workflow" />

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Available Actions */}
                <WorkflowActions
                    currentStatus={currentStatus}
                    transitions={workflowTransitions}
                    onTransition={handleTransition}
                />

                {/* Status History */}
                <WorkflowTimeline events={timelineEvents} />
            </div>
        </div>
    );
}
