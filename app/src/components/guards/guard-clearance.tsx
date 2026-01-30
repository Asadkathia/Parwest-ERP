'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    CheckCircle2,
    XCircle,
    Clock,
    FileText,
    Package,
    DollarSign,
    AlertCircle
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Mock clearance data
const clearanceItems = {
    documents: [
        { id: 'doc1', label: 'CNIC Copy Returned', completed: true },
        { id: 'doc2', label: 'Original Certificates Returned', completed: true },
        { id: 'doc3', label: 'Company ID Card Collected', completed: false },
        { id: 'doc4', label: 'Uniform Returned', completed: false },
    ],
    equipment: [
        { id: 'eq1', label: 'Torch/Flashlight', completed: true },
        { id: 'eq2', label: 'Whistle', completed: true },
        { id: 'eq3', label: 'Baton', completed: false },
        { id: 'eq4', label: 'Radio/Walkie-Talkie', completed: false },
    ],
    financial: [
        { id: 'fin1', label: 'Final Salary Paid', completed: false },
        { id: 'fin2', label: 'Loan Balance Cleared', completed: false },
        { id: 'fin3', label: 'Advance Recovered', completed: true },
        { id: 'fin4', label: 'No Outstanding Dues', completed: false },
    ],
};

export function GuardClearance() {
    const [checklist, setChecklist] = useState(clearanceItems);
    const { toast } = useToast();

    const handleCheckboxChange = (category: keyof typeof clearanceItems, itemId: string) => {
        setChecklist(prev => ({
            ...prev,
            [category]: prev[category].map(item =>
                item.id === itemId ? { ...item, completed: !item.completed } : item
            ),
        }));
    };

    const calculateProgress = () => {
        const allItems = [
            ...checklist.documents,
            ...checklist.equipment,
            ...checklist.financial,
        ];
        const completed = allItems.filter(item => item.completed).length;
        return {
            completed,
            total: allItems.length,
            percentage: Math.round((completed / allItems.length) * 100),
        };
    };

    const progress = calculateProgress();
    const isFullyCleared = progress.percentage === 100;

    const handleFinalizeClearance = () => {
        if (!isFullyCleared) {
            toast({
                title: 'Clearance Incomplete',
                description: 'Please complete all checklist items before finalizing clearance',
                variant: 'destructive',
            });
            return;
        }

        toast({
            title: 'Clearance Finalized',
            description: 'Guard clearance has been successfully completed',
        });
    };

    return (
        <div className="space-y-6">
            {/* Clearance Status */}
            <Card className="shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Clearance Status</CardTitle>
                        <Badge
                            variant={isFullyCleared ? 'default' : 'secondary'}
                            className="text-xs"
                        >
                            {isFullyCleared ? (
                                <>
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Cleared
                                </>
                            ) : (
                                <>
                                    <Clock className="h-3 w-3 mr-1" />
                                    In Progress
                                </>
                            )}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{progress.completed} / {progress.total} items</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                            <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${progress.percentage}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {progress.percentage}% complete
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Documents Checklist */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">Documents</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {checklist.documents.map((item) => (
                            <div key={item.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={item.id}
                                    checked={item.completed}
                                    onCheckedChange={() => handleCheckboxChange('documents', item.id)}
                                />
                                <Label
                                    htmlFor={item.id}
                                    className={`flex-1 text-sm font-normal cursor-pointer ${item.completed ? 'line-through text-muted-foreground' : ''
                                        }`}
                                >
                                    {item.label}
                                </Label>
                                {item.completed && <CheckCircle2 className="h-4 w-4 text-success" />}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Equipment Checklist */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">Equipment & Assets</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {checklist.equipment.map((item) => (
                            <div key={item.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={item.id}
                                    checked={item.completed}
                                    onCheckedChange={() => handleCheckboxChange('equipment', item.id)}
                                />
                                <Label
                                    htmlFor={item.id}
                                    className={`flex-1 text-sm font-normal cursor-pointer ${item.completed ? 'line-through text-muted-foreground' : ''
                                        }`}
                                >
                                    {item.label}
                                </Label>
                                {item.completed && <CheckCircle2 className="h-4 w-4 text-success" />}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Financial Clearance */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">Financial Clearance</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {checklist.financial.map((item) => (
                            <div key={item.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={item.id}
                                    checked={item.completed}
                                    onCheckedChange={() => handleCheckboxChange('financial', item.id)}
                                />
                                <Label
                                    htmlFor={item.id}
                                    className={`flex-1 text-sm font-normal cursor-pointer ${item.completed ? 'line-through text-muted-foreground' : ''
                                        }`}
                                >
                                    {item.label}
                                </Label>
                                {item.completed && <CheckCircle2 className="h-4 w-4 text-success" />}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Finalize Button */}
            <Card className="shadow-sm border-dashed">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                        {!isFullyCleared && (
                            <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                        )}
                        <div className="flex-1">
                            <h4 className="font-medium mb-1">
                                {isFullyCleared ? 'Ready to Finalize' : 'Clearance Incomplete'}
                            </h4>
                            <p className="text-sm text-muted-foreground mb-4">
                                {isFullyCleared
                                    ? 'All checklist items have been completed. You can now finalize the clearance.'
                                    : 'Complete all checklist items above before finalizing the clearance process.'}
                            </p>
                            <Button
                                onClick={handleFinalizeClearance}
                                disabled={!isFullyCleared}
                                className="w-full sm:w-auto"
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Finalize Clearance
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
