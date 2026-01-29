'use client';

import * as React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Check, ArrowRight, UserPlus, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Schema Definitions
const personalInfoSchema = z.object({
    fullName: z.string().min(3, 'Full name is required'),
    fatherName: z.string().min(3, "Father's name is required"),
    cnic: z.string().regex(/^\d{5}-\d{7}-\d{1}$/, 'Invalid CNIC format (e.g. 33100-1234567-1)'),
    dob: z.string().refine((date) => new Date(date) < new Date(), 'Date of birth must be in the past'),
    gender: z.enum(['male', 'female', 'other']),
    maritalStatus: z.string().optional(),
});

const contactInfoSchema = z.object({
    mobileNo: z.string().regex(/^(\+92|0)?3\d{9}$/, 'Invalid mobile number'),
    emergencyContact: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().min(10, 'Complete address is required'),
    city: z.string().min(2, 'City is required'),
});

const employmentInfoSchema = z.object({
    designation: z.string().min(1, 'Designation is required'),
    joiningDate: z.string(),
    shift: z.string(),
    // Using z.any() to bypass strict numeric coercion type issues with react-hook-form resolver types
    // We validate the number value manually or via register options
    salary: z.coerce.number().min(10000, 'Invalid salary amount'),
});

// Combined Schema
const guardFormSchema = z.intersection(
    z.intersection(personalInfoSchema, contactInfoSchema),
    employmentInfoSchema
);

type GuardFormData = z.infer<typeof guardFormSchema>;

const STEPS = [
    { id: 1, title: 'Personal Info', description: 'Basic identity details' },
    { id: 2, title: 'Contact Details', description: 'Address and phone' },
    { id: 3, title: 'Employment', description: 'Job role and salary' },
];

export function CreateGuardDrawer() {
    const [open, setOpen] = React.useState(false);
    const [step, setStep] = React.useState(1);
    const [formData, setFormData] = React.useState<Partial<GuardFormData>>({});

    // Step 1 Form
    const form1 = useForm<z.infer<typeof personalInfoSchema>>({
        resolver: zodResolver(personalInfoSchema),
        defaultValues: { fullName: '', fatherName: '', cnic: '', dob: '', gender: 'male', maritalStatus: '' },
        mode: 'onChange'
    });

    // Step 2 Form
    const form2 = useForm<z.infer<typeof contactInfoSchema>>({
        resolver: zodResolver(contactInfoSchema),
        defaultValues: { mobileNo: '', emergencyContact: '', email: '', address: '', city: '' },
        mode: 'onChange'
    });

    const form3 = useForm<z.infer<typeof employmentInfoSchema>>({
        resolver: zodResolver(employmentInfoSchema) as any,
        defaultValues: { designation: '', joiningDate: new Date().toISOString().split('T')[0], shift: 'day', salary: 0 },
        mode: 'onChange'
    });

    const onStep1Submit: SubmitHandler<z.infer<typeof personalInfoSchema>> = (data) => {
        setFormData((prev) => ({ ...prev, ...data }));
        setStep(2);
    };

    const onStep2Submit: SubmitHandler<z.infer<typeof contactInfoSchema>> = (data) => {
        setFormData((prev) => ({ ...prev, ...data }));
        setStep(3);
    };

    const onFinalSubmit: SubmitHandler<z.infer<typeof employmentInfoSchema>> = (data) => {
        const finalData = { ...formData, ...data };
        console.log('Final Form Data:', finalData);
        // TODO: Call Supabase API to create guard
        setOpen(false);
        setStep(1);
        form1.reset();
        form2.reset();
        form3.reset();
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add New Guard
                </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[85vh]">
                <div className="mx-auto w-full max-w-2xl h-full flex flex-col">
                    <DrawerHeader>
                        <DrawerTitle>Register New Guard</DrawerTitle>
                        <DrawerDescription>
                            Complete the steps below to onboard a new security guard.
                        </DrawerDescription>

                        {/* Stepper */}
                        <div className="flex items-center justify-between mt-6 mb-2 relative">
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -z-10" />
                            {STEPS.map((s) => (
                                <div key={s.id} className="flex flex-col items-center bg-background px-2">
                                    <div
                                        className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                                            step >= s.id
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-muted text-muted-foreground border-muted"
                                        )}
                                    >
                                        {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                                    </div>
                                    <span className={cn(
                                        "text-xs mt-2 font-medium",
                                        step >= s.id ? "text-foreground" : "text-muted-foreground"
                                    )}>
                                        {s.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </DrawerHeader>

                    <ScrollArea className="flex-1 px-4 overflow-y-auto">
                        <div className="pb-6">
                            {step === 1 && (
                                <form id="step1-form" onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="fullName">Full Name *</Label>
                                            <Input id="fullName" {...form1.register('fullName')} placeholder="e.g. Muhammad Ali" />
                                            {form1.formState.errors.fullName && <p className="text-xs text-destructive">{form1.formState.errors.fullName.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="fatherName">Father's Name *</Label>
                                            <Input id="fatherName" {...form1.register('fatherName')} placeholder="e.g. Abdul Rehman" />
                                            {form1.formState.errors.fatherName && <p className="text-xs text-destructive">{form1.formState.errors.fatherName.message}</p>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="cnic">CNIC *</Label>
                                            <Input id="cnic" {...form1.register('cnic')} placeholder="35202-1234567-1" />
                                            {form1.formState.errors.cnic && <p className="text-xs text-destructive">{form1.formState.errors.cnic.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="dob">Date of Birth *</Label>
                                            <Input id="dob" type="date" {...form1.register('dob')} />
                                            {form1.formState.errors.dob && <p className="text-xs text-destructive">{form1.formState.errors.dob.message}</p>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="gender">Gender</Label>
                                            <Select defaultValue="male" onValueChange={(val) => form1.setValue('gender', val as any)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="male">Male</SelectItem>
                                                    <SelectItem value="female">Female</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="maritalStatus">Marital Status</Label>
                                            <Select onValueChange={(val) => form1.setValue('maritalStatus', val)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="single">Single</SelectItem>
                                                    <SelectItem value="married">Married</SelectItem>
                                                    <SelectItem value="divorced">Divorced</SelectItem>
                                                    <SelectItem value="widowed">Widowed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {step === 2 && (
                                <form id="step2-form" onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="mobileNo">Mobile Number *</Label>
                                            <Input id="mobileNo" {...form2.register('mobileNo')} placeholder="03001234567" />
                                            {form2.formState.errors.mobileNo && <p className="text-xs text-destructive">{form2.formState.errors.mobileNo.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="emergencyContact">Emergency Contact</Label>
                                            <Input id="emergencyContact" {...form2.register('emergencyContact')} placeholder="Relative's Number" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address</Label>
                                        <Input id="email" type="email" {...form2.register('email')} placeholder="Optional" />
                                        {form2.formState.errors.email && <p className="text-xs text-destructive">{form2.formState.errors.email.message}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="address">Permanent Address *</Label>
                                        <Input id="address" {...form2.register('address')} placeholder="House, Street, Mohallah" />
                                        {form2.formState.errors.address && <p className="text-xs text-destructive">{form2.formState.errors.address.message}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="city">City *</Label>
                                        <Input id="city" {...form2.register('city')} placeholder="Lahore" />
                                        {form2.formState.errors.city && <p className="text-xs text-destructive">{form2.formState.errors.city.message}</p>}
                                    </div>
                                </form>
                            )}

                            {step === 3 && (
                                <form id="step3-form" onSubmit={form3.handleSubmit(onFinalSubmit)} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="designation">Designation *</Label>
                                            <Select onValueChange={(val) => form3.setValue('designation', val)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Security Guard">Security Guard</SelectItem>
                                                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                                                    <SelectItem value="Lady Guard">Lady Guard</SelectItem>
                                                    <SelectItem value="Armed Guard">Armed Guard</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {form3.formState.errors.designation && <p className="text-xs text-destructive">{form3.formState.errors.designation.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="joiningDate">Joining Date *</Label>
                                            <Input id="joiningDate" type="date" {...form3.register('joiningDate')} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="shift">Default Shift</Label>
                                            <Select defaultValue="day" onValueChange={(val) => form3.setValue('shift', val)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Shift" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="day">Day (12h)</SelectItem>
                                                    <SelectItem value="night">Night (12h)</SelectItem>
                                                    <SelectItem value="morning">Morning (8h)</SelectItem>
                                                    <SelectItem value="evening">Evening (8h)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="salary">Basic Salary (PKR) *</Label>
                                            <Input
                                                id="salary"
                                                type="number"
                                                {...form3.register('salary')}
                                                placeholder="e.g. 32000"
                                            />
                                            {form3.formState.errors.salary && <p className="text-xs text-destructive">{form3.formState.errors.salary.message}</p>}
                                        </div>
                                    </div>

                                    <div className="rounded-md bg-muted p-4 mt-6">
                                        <h4 className="text-sm font-medium mb-2">Review Summary</h4>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <p>Name: {formData.fullName}</p>
                                            <p>CNIC: {formData.cnic}</p>
                                            <p>Contact: {formData.mobileNo}</p>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>
                    </ScrollArea>

                    <DrawerFooter className="border-t pt-4">
                        <div className="flex justify-between items-center w-full">
                            <Button
                                variant="outline"
                                onClick={() => setStep(prev => Math.max(1, prev - 1))}
                                disabled={step === 1}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back
                            </Button>

                            {step < 3 ? (
                                <Button onClick={() => {
                                    if (step === 1) form1.handleSubmit(onStep1Submit)();
                                    if (step === 2) form2.handleSubmit(onStep2Submit)();
                                }}>
                                    Next Step <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button onClick={form3.handleSubmit(onFinalSubmit)}>
                                    Create Guard <Check className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <DrawerClose asChild>
                            <Button variant="ghost" className="mt-2">Cancel Verification</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
