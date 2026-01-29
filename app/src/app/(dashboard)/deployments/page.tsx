import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, Download, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DeploymentMatrix } from '@/components/deployments/deployment-matrix';

export const metadata: Metadata = {
    title: 'Deployments',
    description: 'Manage guard deployments',
};

export default function DeploymentsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Deployments"
                description="Manage guard deployments and roster matrix"
                breadcrumbs={[{ label: 'Deployments' }]}
                actions={
                    <>
                        <Button variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Export Roster
                        </Button>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            New Assignment
                        </Button>
                    </>
                }
            />

            {/* Deployment Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Requirements
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">482</div>
                        <p className="text-xs text-muted-foreground mt-1">Total guard slots</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Fill Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-success">96.5%</div>
                        <div className="flex items-center text-xs text-success mt-1">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            465 / 482 Filled
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Open Slots
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">17</div>
                        <div className="flex items-center text-xs text-destructive mt-1">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Action Required
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Relievers Deployed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-warning">12</div>
                        <p className="text-xs text-muted-foreground mt-1">Covering absentees</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input placeholder="Search site, client, or supervisor..." className="pl-10" />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                                <Filter className="h-4 w-4 mr-2" />
                                Filters
                            </Button>
                            <Button variant="outline" size="sm">
                                Region
                            </Button>
                            <Button variant="outline" size="sm">
                                Shift
                            </Button>
                            <Button variant="outline" size="sm">
                                Status
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Matrix Component */}
            <DeploymentMatrix />
        </div>
    );
}
