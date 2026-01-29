'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

interface GuardOverviewProps {
    guard: any; // Using any for mock data convenience, ideally defined type
}

export function GuardOverview({ guard }: GuardOverviewProps) {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Personal Information */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Father's Name</label>
                            <span className="font-medium">Abdul Rehman Khan</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Date of Birth</label>
                            <span className="font-medium">12 Oct 1985 (39 yrs)</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Gender</label>
                            <span className="font-medium capitalize">Male</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Marital Status</label>
                            <span className="font-medium capitalize">Married</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Mobile No</label>
                            <span className="font-medium">{guard.contact}</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Emergency Contact</label>
                            <span className="font-medium">+92 321 7654321</span>
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Permanent Address</label>
                        <span className="font-medium text-sm">House #123, Street 4, Mohallah Gunj, Lahore City, Punjab</span>
                    </div>
                </CardContent>
            </Card>

            {/* Employment Status */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Employment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Designation</label>
                            <span className="font-medium">{guard.designation}</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Joining Date</label>
                            <span className="font-medium">{guard.joining_date}</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Current Branch</label>
                            <span className="font-medium">{guard.current_deployment}</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Shift</label>
                            <span className="font-medium">Day (08:00 - 20:00)</span>
                        </div>
                    </div>

                    <div className="rounded-md bg-muted p-3 mt-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Status</span>
                            <Badge variant="outline" className="text-success border-success/30 bg-success/5">
                                On Duty
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>Deployed at site since 08:15 AM</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Education & Banking */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Education & Banking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Education</label>
                            <span className="font-medium">Matric (Science)</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Institute</label>
                            <span className="font-medium">Govt High School Lahore</span>
                        </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Bank Name</label>
                            <span className="font-medium">Meezan Bank</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Account Title</label>
                            <span className="font-medium">{guard.name}</span>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-muted-foreground block mb-1">IBAN</label>
                            <span className="font-mono">PK67MEZN0012345678901234</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Physical Attributes */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Physical Attributes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Height</label>
                            <span className="font-medium">5' 11"</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Weight</label>
                            <span className="font-medium">78 kg</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Blood Group</label>
                            <span className="font-medium">B+</span>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Identification Mark</label>
                            <span className="font-medium">Scar on left eyebrow</span>
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Uniform Size</label>
                        <div className="flex gap-4 text-sm mt-1">
                            <span className="px-2 py-1 bg-muted rounded">Shirt: L</span>
                            <span className="px-2 py-1 bg-muted rounded">Pant: 34</span>
                            <span className="px-2 py-1 bg-muted rounded">Shoes: 10</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
