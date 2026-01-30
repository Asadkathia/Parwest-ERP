'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Permission matrix based on permissions.ts
const permissionMatrix = {
    guards: {
        admin: ['view', 'create', 'edit', 'delete', 'approve'],
        operations_manager: ['view', 'create', 'edit'],
        hr_manager: ['view', 'create', 'edit', 'approve'],
        finance_manager: ['view'],
        supervisor: ['view'],
        guard: ['view'],
    },
    clients: {
        admin: ['view', 'create', 'edit', 'delete'],
        operations_manager: ['view', 'create', 'edit'],
        hr_manager: ['view'],
        finance_manager: ['view', 'edit'],
        supervisor: ['view'],
        guard: [],
    },
    deployments: {
        admin: ['view', 'create', 'edit', 'delete'],
        operations_manager: ['view', 'create', 'edit', 'delete'],
        hr_manager: ['view'],
        finance_manager: ['view'],
        supervisor: ['view'],
        guard: ['view'],
    },
    attendance: {
        admin: ['view', 'create', 'edit', 'approve', 'export'],
        operations_manager: ['view', 'edit', 'export'],
        hr_manager: ['view', 'approve', 'export'],
        finance_manager: ['view', 'export'],
        supervisor: ['view', 'create', 'edit'],
        guard: ['view'],
    },
    payroll: {
        admin: ['view', 'create', 'edit', 'approve', 'export'],
        operations_manager: ['view'],
        hr_manager: ['view', 'create', 'edit', 'approve', 'export'],
        finance_manager: ['view', 'approve', 'export'],
        supervisor: ['view'],
        guard: ['view'],
    },
    billing: {
        admin: ['view', 'create', 'edit', 'delete', 'export'],
        operations_manager: ['view'],
        hr_manager: ['view'],
        finance_manager: ['view', 'create', 'edit', 'delete', 'export'],
        supervisor: ['view'],
        guard: [],
    },
    inventory: {
        admin: ['view', 'create', 'edit', 'delete'],
        operations_manager: ['view', 'create', 'edit'],
        hr_manager: ['view'],
        finance_manager: ['view'],
        supervisor: ['view'],
        guard: ['view'],
    },
};

const roles = [
    { key: 'admin', label: 'Admin', color: 'bg-red-500' },
    { key: 'operations_manager', label: 'Ops Mgr', color: 'bg-blue-500' },
    { key: 'hr_manager', label: 'HR Mgr', color: 'bg-green-500' },
    { key: 'finance_manager', label: 'Finance', color: 'bg-yellow-500' },
    { key: 'supervisor', label: 'Supervisor', color: 'bg-purple-500' },
    { key: 'guard', label: 'Guard', color: 'bg-gray-500' },
];

const modules = [
    'guards',
    'clients',
    'deployments',
    'attendance',
    'payroll',
    'billing',
    'inventory',
];

const actions = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

export function PermissionsMatrix() {
    return (
        <div className="space-y-6">
            {/* Role Legend */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">System Roles</CardTitle>
                    <CardDescription>
                        Six role levels with granular module permissions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        {roles.map((role) => (
                            <Badge key={role.key} variant="outline" className="px-3 py-1">
                                <div className={`w-2 h-2 rounded-full ${role.color} mr-2`} />
                                {role.label}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Permission Matrix */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Permission Matrix</CardTitle>
                    <CardDescription>
                        Module-level access control by role
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px]">Module</TableHead>
                                    {roles.map((role) => (
                                        <TableHead key={role.key} className="text-center">
                                            {role.label}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {modules.map((module) => (
                                    <TableRow key={module}>
                                        <TableCell className="font-medium capitalize">
                                            {module}
                                        </TableCell>
                                        {roles.map((role) => {
                                            const perms = permissionMatrix[module as keyof typeof permissionMatrix]?.[role.key as keyof typeof permissionMatrix.guards] || [];
                                            return (
                                                <TableCell key={role.key} className="text-center">
                                                    {perms.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 justify-center">
                                                            {perms.map((perm) => (
                                                                <Badge
                                                                    key={perm}
                                                                    variant="secondary"
                                                                    className="text-[10px] px-1.5 py-0"
                                                                >
                                                                    {perm}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <X className="h-4 w-4 text-muted-foreground mx-auto" />
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Actions Reference */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Available Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {actions.map((action) => (
                            <div key={action} className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-success" />
                                <span className="text-sm capitalize">{action}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
