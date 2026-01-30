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
import { Input } from '@/components/ui/input';
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
import { CalendarIcon, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Mock data
const availableGuards = [
    { id: '1', name: 'Ahmed Hassan', parwest_id: 'PW-2024-015', status: 'pending_deployment' },
    { id: '2', name: 'Bilal Khan', parwest_id: 'PW-2024-023', status: 'pending_deployment' },
    { id: '3', name: 'Imran Ali', parwest_id: 'PW-2024-031', status: 'pending_deployment' },
];

const clients = [
    { id: '1', name: 'ABC Bank', sites: ['Gulberg Branch', 'DHA Branch', 'Johar Town Branch'] },
    { id: '2', name: 'TechFlow Solutions', sites: ['Head Office', 'Warehouse'] },
    { id: '3', name: 'Metro Mall', sites: ['Main Entrance', 'Parking', 'Loading Bay'] },
];

export function DeployGuardDrawer() {
    const [open, setOpen] = useState(false);
    const [selectedGuard, setSelectedGuard] = useState('');
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedSite, setSelectedSite] = useState('');
    const [shiftType, setShiftType] = useState('');
    const [deploymentType, setDeploymentType] = useState('');
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [notes, setNotes] = useState('');
    const { toast } = useToast();

    const selectedClientData = clients.find(c => c.id === selectedClient);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!selectedGuard || !selectedClient || !selectedSite || !shiftType || !deploymentType || !startDate) {
            toast({
                title: 'Validation Error',
                description: 'Please fill in all required fields',
                variant: 'destructive',
            });
            return;
        }

        if (endDate && endDate < startDate) {
            toast({
                title: 'Validation Error',
                description: 'End date must be after start date',
                variant: 'destructive',
            });
            return;
        }

        // Mock success
        const guard = availableGuards.find(g => g.id === selectedGuard);
        const client = clients.find(c => c.id === selectedClient);

        toast({
            title: 'Deployment Created',
            description: `${guard?.name} deployed to ${client?.name} - ${selectedSite}`,
        });

        // Reset form
        setSelectedGuard('');
        setSelectedClient('');
        setSelectedSite('');
        setShiftType('');
        setDeploymentType('');
        setStartDate(undefined);
        setEndDate(undefined);
        setNotes('');
        setOpen(false);
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Deploy Guard
                </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[90vh]">
                <DrawerHeader>
                    <DrawerTitle>Deploy Guard to Site</DrawerTitle>
                    <DrawerDescription>
                        Assign a guard to a client site with shift details
                    </DrawerDescription>
                </DrawerHeader>
                <form onSubmit={handleSubmit} className="px-4 overflow-y-auto">
                    <div className="space-y-4 pb-4">
                        {/* Guard Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="guard">Guard *</Label>
                            <Select value={selectedGuard} onValueChange={setSelectedGuard}>
                                <SelectTrigger id="guard">
                                    <SelectValue placeholder="Select guard" />
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

                        {/* Client Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="client">Client *</Label>
                            <Select value={selectedClient} onValueChange={(value) => {
                                setSelectedClient(value);
                                setSelectedSite(''); // Reset site when client changes
                            }}>
                                <SelectTrigger id="client">
                                    <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((client) => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Site Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="site">Site/Branch *</Label>
                            <Select
                                value={selectedSite}
                                onValueChange={setSelectedSite}
                                disabled={!selectedClient}
                            >
                                <SelectTrigger id="site">
                                    <SelectValue placeholder="Select site" />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectedClientData?.sites.map((site) => (
                                        <SelectItem key={site} value={site}>
                                            {site}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Shift Type */}
                        <div className="space-y-2">
                            <Label htmlFor="shift">Shift Type *</Label>
                            <Select value={shiftType} onValueChange={setShiftType}>
                                <SelectTrigger id="shift">
                                    <SelectValue placeholder="Select shift" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">Day Shift (8 AM - 8 PM)</SelectItem>
                                    <SelectItem value="night">Night Shift (8 PM - 8 AM)</SelectItem>
                                    <SelectItem value="24hr">24 Hour</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Deployment Type */}
                        <div className="space-y-2">
                            <Label htmlFor="type">Deployment Type *</Label>
                            <Select value={deploymentType} onValueChange={setDeploymentType}>
                                <SelectTrigger id="type">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="permanent">Permanent</SelectItem>
                                    <SelectItem value="temporary">Temporary</SelectItem>
                                    <SelectItem value="reliever">Reliever</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Start Date */}
                        <div className="space-y-2">
                            <Label>Start Date *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !startDate && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={setStartDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <Label>End Date (Optional)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !endDate && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={endDate}
                                        onSelect={setEndDate}
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
                                placeholder="Additional deployment notes..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DrawerFooter className="px-0">
                        <Button type="submit">Deploy Guard</Button>
                        <DrawerClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </form>
            </DrawerContent>
        </Drawer>
    );
}
