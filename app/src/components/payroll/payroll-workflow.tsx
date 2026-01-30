'use client';

import { WorkflowStepper, WorkflowStep } from '@/components/workflow/workflow-stepper';
import { WorkflowActions, WorkflowTransition } from '@/components/workflow/workflow-actions';
import { WorkflowTimeline, TimelineEvent } from '@/components/workflow/workflow-timeline';
import { useToast } from '@/hooks/use-toast';
import { Calculator, FileCheck, CheckCircle2, Lock, Download } from 'lucide-react';

// Mock payroll workflow data
const workflowSteps: WorkflowStep[] = [
    { id: '1', label: 'Draft', status: 'completed', timestamp: 'Jan 25, 2026' },
    { id: '2', label: 'Calculated', status: 'completed', timestamp: 'Jan 27, 2026' },
    { id: '3', label: 'Reviewed', status: 'completed', timestamp: 'Jan 28, 2026' },
    { id: '4', label: 'Approved', status: 'current', timestamp: 'Jan 29, 2026' },
    { id: '5', label: 'Finalized', status: 'upcoming' },
    { id: '6', label: 'Exported', status: 'upcoming' },
];

const workflowTransitions: WorkflowTransition[] = [
    {
        id: 'calculate',
        label: 'Calculate Payroll',
        fromStatus: 'draft',
        toStatus: 'calculated',
        icon: Calculator,
        variant: 'default',
        validationHint: 'Attendance must be locked before calculation',
    },
    {
        id: 'review',
        label: 'Mark as Reviewed',
        fromStatus: 'calculated',
        toStatus: 'reviewed',
        icon: FileCheck,
        variant: 'default',
        validationHint: 'Verify all calculations and deductions',
    },
    {
        id: 'approve',
        label: 'Approve Payroll',
        fromStatus: 'reviewed',
        toStatus: 'approved',
        icon: CheckCircle2,
        variant: 'default',
        requiresApproval: true,
        validationHint: 'Finance Manager approval required',
    },
    {
        id: 'finalize',
        label: 'Finalize Payroll',
        fromStatus: 'approved',
        toStatus: 'finalized',
        icon: Lock,
        variant: 'default',
        validationHint: 'Payroll will be locked for processing',
    },
    {
        id: 'export',
        label: 'Export for Payment',
        fromStatus: 'finalized',
        toStatus: 'exported',
        icon: Download,
        variant: 'default',
        validationHint: 'Generate bank transfer file',
    },
];

const timelineEvents: TimelineEvent[] = [
    {
        id: '1',
        status: 'Approved',
        timestamp: 'Jan 29, 2026 3:00 PM',
        user: 'Sara Malik (Finance Manager)',
        note: 'Payroll approved for processing',
    },
    {
        id: '2',
        status: 'Reviewed',
        timestamp: 'Jan 28, 2026 2:30 PM',
        user: 'Usman Tariq (Finance)',
        note: 'All calculations verified',
    },
    {
        id: '3',
        status: 'Calculated',
        timestamp: 'Jan 27, 2026 10:00 AM',
        user: 'System',
        note: 'Payroll calculated for 245 guards',
    },
    {
        id: '4',
        status: 'Draft',
        timestamp: 'Jan 25, 2026 9:00 AM',
        user: 'Sara Malik (Finance Manager)',
        note: 'January 2026 payroll period created',
    },
];

export function PayrollWorkflow() {
    const { toast } = useToast();
    const currentStatus = 'approved';

    const handleTransition = (transition: WorkflowTransition) => {
        toast({
            title: 'Payroll Status Change',
            description: `Payroll will be changed to: ${transition.toStatus}`,
        });
    };

    return (
        <div className="space-y-6">
            {/* Workflow Stepper */}
            <WorkflowStepper steps={workflowSteps} title="Payroll Period Workflow" />

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
