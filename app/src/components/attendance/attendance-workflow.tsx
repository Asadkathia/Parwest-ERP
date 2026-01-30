'use client';

import { WorkflowStepper, WorkflowStep } from '@/components/workflow/workflow-stepper';
import { WorkflowActions, WorkflowTransition } from '@/components/workflow/workflow-actions';
import { WorkflowTimeline, TimelineEvent } from '@/components/workflow/workflow-timeline';
import { useToast } from '@/hooks/use-toast';
import { Send, FileCheck, CheckCircle2, Lock } from 'lucide-react';

// Mock attendance workflow data
const workflowSteps: WorkflowStep[] = [
    { id: '1', label: 'Draft', status: 'completed', timestamp: 'Jan 25, 2026' },
    { id: '2', label: 'Submitted', status: 'completed', timestamp: 'Jan 28, 2026' },
    { id: '3', label: 'Reviewed', status: 'current', timestamp: 'Jan 29, 2026' },
    { id: '4', label: 'Approved', status: 'upcoming' },
    { id: '5', label: 'Locked', status: 'upcoming' },
];

const workflowTransitions: WorkflowTransition[] = [
    {
        id: 'submit',
        label: 'Submit for Review',
        fromStatus: 'draft',
        toStatus: 'submitted',
        icon: Send,
        variant: 'default',
        validationHint: 'All daily attendance must be marked',
    },
    {
        id: 'review',
        label: 'Mark as Reviewed',
        fromStatus: 'submitted',
        toStatus: 'reviewed',
        icon: FileCheck,
        variant: 'default',
        validationHint: 'Verify all attendance records are accurate',
    },
    {
        id: 'approve',
        label: 'Approve Attendance',
        fromStatus: 'reviewed',
        toStatus: 'approved',
        icon: CheckCircle2,
        variant: 'default',
        requiresApproval: true,
        validationHint: 'Manager approval required',
    },
    {
        id: 'lock',
        label: 'Lock Period',
        fromStatus: 'approved',
        toStatus: 'locked',
        icon: Lock,
        variant: 'secondary',
        validationHint: 'Attendance will be locked for payroll processing',
    },
];

const timelineEvents: TimelineEvent[] = [
    {
        id: '1',
        status: 'Reviewed',
        timestamp: 'Jan 29, 2026 11:00 AM',
        user: 'Bilal Ahmed (Operations Manager)',
        note: 'Attendance records verified',
    },
    {
        id: '2',
        status: 'Submitted',
        timestamp: 'Jan 28, 2026 5:30 PM',
        user: 'Hassan Raza (Supervisor)',
        note: 'All daily attendance completed',
    },
    {
        id: '3',
        status: 'Draft',
        timestamp: 'Jan 25, 2026 9:00 AM',
        user: 'System',
        note: 'Attendance period created',
    },
];

export function AttendanceWorkflow() {
    const { toast } = useToast();
    const currentStatus = 'reviewed';

    const handleTransition = (transition: WorkflowTransition) => {
        toast({
            title: 'Attendance Status Change',
            description: `Attendance will be changed to: ${transition.toStatus}`,
        });
    };

    return (
        <div className="space-y-6">
            {/* Workflow Stepper */}
            <WorkflowStepper steps={workflowSteps} title="Attendance Period Workflow" />

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
