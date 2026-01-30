'use client';

import { useState, useEffect } from 'react';
import { can, hasPermission, getCurrentUser, hasRole, type Module, type Action, type UserRole } from '@/lib/permissions';

/**
 * React hook for permission checks in components
 * Usage: const canEdit = usePermission('guards', 'edit');
 */
export function usePermission(module: Module, action: Action): boolean {
    const [permitted, setPermitted] = useState(false);

    useEffect(() => {
        setPermitted(can(module, action));
    }, [module, action]);

    return permitted;
}

/**
 * Hook to get current user info
 */
export function useCurrentUser() {
    const [user, setUser] = useState(getCurrentUser());

    useEffect(() => {
        setUser(getCurrentUser());
    }, []);

    return user;
}

/**
 * Hook to check if user has specific role(s)
 */
export function useHasRole(...roles: UserRole[]): boolean {
    const [hasRoleCheck, setHasRoleCheck] = useState(false);

    useEffect(() => {
        setHasRoleCheck(hasRole(...roles));
    }, [roles]);

    return hasRoleCheck;
}

/**
 * Hook for multiple permission checks
 * Usage: const { canView, canEdit } = usePermissions('guards', ['view', 'edit']);
 */
export function usePermissions(module: Module, actions: Action[]): Record<string, boolean> {
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const perms: Record<string, boolean> = {};
        actions.forEach(action => {
            perms[`can${action.charAt(0).toUpperCase()}${action.slice(1)}`] = can(module, action);
        });
        setPermissions(perms);
    }, [module, actions]);

    return permissions;
}
