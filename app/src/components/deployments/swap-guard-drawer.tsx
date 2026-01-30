'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
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
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Repeat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Mock data
const activeDeployments = [
    { id: '1', guard: 'Muhammad Ali Khan', guardId: 'PW-2024-001', client: 'ABC Bank', site: 'Gulberg Branch' },
    { id: '2', guard: 'Usman Ahmed', guardId: 'PW-2024-005', client: 'TechFlow Solutions', site: 'Head Office' },
    { id: '3', guard: 'Hassan Raza', guardId: 'PW-2024-012', client: 'Metro Mall', site: 'Main Entrance' },
];

const availableGuards = [
    { id: '10', name: 'Ahmed Hassan', parwest_id: 'PW-2024-015' },
    { id: '11', name: 'Bilal Khan', parwest_id: 'PW-2024-023' },
    { id: '12', name: 'Imran Ali', parwest_id: 'PW-2024-031' },
];

const swapReasons = [
    { value: 'resignation', label: 'Resignation' },
    { value: 'medical', label: 'Medical Leave' },
    { value: 'performance', label: 'Performance Issues' },
    { value: 'rotation', label: 'Routine Rotation' },
    { value: 'client_request', label: 'Client Request' },
    { value: 'other', label: 'Other' },
];

interface SwapGuardDrawerProps {
    deploymentId?: string;
    trigger?: React.ReactNode;
}

export function SwapGuardDrawer({ deploymentId, trigger }: SwapGuardDrawerProps) {
    const [open, setOpen] = useState(false);
    const [selectedDeployment, setSelectedDeployment] = useState(deploymentId || '');
    const [replacementGuard, setReplacementGuard] = useState('');
    const [reason, setReason] = useState('');
    const [effectiveDate, setEffectiveDate] = useState<Date>();
    const [notes, setNotes] = useState('');
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!selectedDeployment || !replacementGuard || !reason || !effectiveDate) {
            toast({
                title: 'Validation Error',
                description: 'Please fill in all required fields',
                variant: 'destructive',
            });
            return;
        }

        // Mock success
        const deployment = activeDeployments.find(d => d.id === selectedDeployment);
        const newGuard = availableGuards.find(g => g.id === replacementGuard);

        toast({
            title: 'Guard Swapped',
            description: `${deployment?.guard} replaced with ${newGuard?.name} at ${deployment?.site}`,
        });

        // Reset form
        setSelectedDeployment('');
        setReplacementGuard('');
        setReason('');
        setEffectiveDate(undefined);
        setNotes('');
        setOpen(false);
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Repeat className="h-4 w-4 mr-2" />
                        Swap Guard
                    </Button>
                )}
            </DrawerTrigger>
            <DrawerContent className="max-h-[90vh]">
                <DrawerHeader>
                    <DrawerTitle>Swap Guard</DrawerTitle>
                    <DrawerDescription>
                        Replace a deployed guard with another available guard
                    </DrawerDescription>
                </DrawerHeader>
                <form onSubmit={handleSubmit} className="px-4 overflow-y-auto">
                    <div className="space-y-4 pb-4">
                        {/* Current Deployment */}
                        <div className="space-y-2">
                            <Label htmlFor="deployment">Current Deployment *</Label>
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

                        {/* Replacement Guard */}
                        <div className="space-y-2">
                            <Label htmlFor="replacement">Replacement Guard *</Label>
                            <Select value={replacementGuard} onValueChange={setReplacementGuard}>
                                <SelectTrigger id="replacement">
                                    <SelectValue placeholder="Select replacement guard" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableGuards.map((guard) => (
                                        <SelectItem key={guard.id} value={guard.id}>
                                            {guard.name} ({guard.parwest_id})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Swap Reason */}
                        <div className="space-y-2">
                            <Label htmlFor="reason">Swap Reason *</Label>
                            <Select value={reason} onValueChange={setReason}>
                                <SelectTrigger id="reason">
                                    <SelectValue placeholder="Select reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    {swapReasons.map((r) => (
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

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Additional swap details..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DrawerFooter className="px-0">
                        <Button type="submit">Confirm Swap</Button>
                        <DrawerClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </form>
            </DrawerContent>
        </Drawer>
    );
}
