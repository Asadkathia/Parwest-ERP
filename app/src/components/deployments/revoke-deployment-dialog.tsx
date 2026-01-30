'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Mock data
const activeDeployments = [
    { id: '1', guard: 'Muhammad Ali Khan', guardId: 'PW-2024-001', client: 'ABC Bank', site: 'Gulberg Branch' },
    { id: '2', guard: 'Usman Ahmed', guardId: 'PW-2024-005', client: 'TechFlow Solutions', site: 'Head Office' },
    { id: '3', guard: 'Hassan Raza', guardId: 'PW-2024-012', client: 'Metro Mall', site: 'Main Entrance' },
];

const revocationReasons = [
    { value: 'resignation', label: 'Guard Resignation' },
    { value: 'termination', label: 'Termination' },
    { value: 'contract_end', label: 'Contract End' },
    { value: 'client_request', label: 'Client Request' },
    { value: 'performance', label: 'Performance Issues' },
    { value: 'other', label: 'Other' },
];

interface RevokeDeploymentDialogProps {
    deploymentId?: string;
    trigger?: React.ReactNode;
}

export function RevokeDeploymentDialog({ deploymentId, trigger }: RevokeDeploymentDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedDeployment, setSelectedDeployment] = useState(deploymentId || '');
    const [reason, setReason] = useState('');
    const [effectiveDate, setEffectiveDate] = useState<Date>();
    const [isCleared, setIsCleared] = useState(false);
    const [notes, setNotes] = useState('');
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!selectedDeployment || !reason || !effectiveDate) {
            toast({
                title: 'Validation Error',
                description: 'Please fill in all required fields',
                variant: 'destructive',
            });
            return;
        }

        // Mock success
        const deployment = activeDeployments.find(d => d.id === selectedDeployment);

        toast({
            title: 'Deployment Revoked',
            description: `${deployment?.guard} removed from ${deployment?.site}`,
            variant: 'destructive',
        });

        // Reset form
        setSelectedDeployment('');
        setReason('');
        setEffectiveDate(undefined);
        setIsCleared(false);
        setNotes('');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="destructive" size="sm">
                        <XCircle className="h-4 w-4 mr-2" />
                        Revoke
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Revoke Deployment</DialogTitle>
                    <DialogDescription>
                        End a guard's assignment at a client site
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Deployment Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="deployment">Deployment *</Label>
                            <Select
                                value={selectedDeployment}
                                onValueChange={setSelectedDeployment}
                                disabled={!!deploymentId}
                            >
                                <SelectTrigger id="deployment">
                                    <SelectValue placeholder="Select deployment" />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeDeployments.map((deployment) => (
                                        <SelectItem key={deployment.id} value={deployment.id}>
                                            {deployment.guard} @ {deployment.client} - {deployment.site}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Revocation Reason */}
                        <div className="space-y-2">
                            <Label htmlFor="reason">Revocation Reason *</Label>
                            <Select value={reason} onValueChange={setReason}>
                                <SelectTrigger id="reason">
                                    <SelectValue placeholder="Select reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    {revocationReasons.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                            {r.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Effective Date */}
                        <div className="space-y-2">
                            <Label>Effective Date *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !effectiveDate && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {effectiveDate ? format(effectiveDate, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={effectiveDate}
                                        onSelect={setEffectiveDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Settlement Status */}
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="cleared"
                                checked={isCleared}
                                onCheckedChange={(checked) => setIsCleared(checked as boolean)}
                            />
                            <Label
                                htmlFor="cleared"
                                className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Final settlement cleared
                            </Label>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Additional revocation details..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="destructive">
                            Revoke Deployment
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
