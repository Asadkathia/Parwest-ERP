import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata: Metadata = {
    title: 'Settings',
    description: 'System settings',
};

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Settings"
                description="Manage system settings and configurations"
                breadcrumbs={[{ label: 'Settings' }]}
            />

            <Tabs defaultValue="users" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
                    <TabsTrigger value="workflows">Workflows</TabsTrigger>
                    <TabsTrigger value="lookups">Lookups</TabsTrigger>
                </TabsList>

                <TabsContent value="users">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>User Management</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                User management coming soon.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="roles">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Roles & Permissions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Role and permission management coming soon.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="workflows">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Workflow Configuration</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Workflow configuration coming soon.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="lookups">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Lookup Tables</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Lookup table management coming soon.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
