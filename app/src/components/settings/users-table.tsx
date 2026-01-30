'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreHorizontal, UserPlus, Mail } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Mock Users Data
const users = [
    {
        id: '1',
        name: 'Admin User',
        email: 'admin@parwest.com',
        role: 'admin',
        status: 'active',
        last_login: '2 hours ago',
    },
    {
        id: '2',
        name: 'Usman Ahmed',
        email: 'usman@parwest.com',
        role: 'operations_manager',
        status: 'active',
        last_login: '1 day ago',
    },
    {
        id: '3',
        name: 'Fatima Khan',
        email: 'fatima@parwest.com',
        role: 'hr_manager',
        status: 'active',
        last_login: '3 hours ago',
    },
    {
        id: '4',
        name: 'Ali Hassan',
        email: 'ali@parwest.com',
        role: 'finance_manager',
        status: 'active',
        last_login: '5 hours ago',
    },
    {
        id: '5',
        name: 'Sara Malik',
        email: 'sara@parwest.com',
        role: 'supervisor',
        status: 'active',
        last_login: '1 week ago',
    },
    {
        id: '6',
        name: 'Test User',
        email: 'test@parwest.com',
        role: 'guard',
        status: 'inactive',
        last_login: 'Never',
    },
];

const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    operations_manager: 'Operations Manager',
    hr_manager: 'HR Manager',
    finance_manager: 'Finance Manager',
    supervisor: 'Supervisor',
    guard: 'Guard',
};

export function UsersTable() {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">System Users</CardTitle>
                <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Login</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-xs bg-primary/10">
                                                {user.name.split(' ').map(n => n[0]).join('')}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{user.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-3 w-3" />
                                        {user.email}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="font-normal">
                                        {roleLabels[user.role]}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={user.status === 'active' ? 'default' : 'secondary'}
                                        className="capitalize"
                                    >
                                        {user.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {user.last_login}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem>Edit User</DropdownMenuItem>
                                            <DropdownMenuItem>Change Role</DropdownMenuItem>
                                            <DropdownMenuItem>Reset Password</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive">
                                                Deactivate
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
