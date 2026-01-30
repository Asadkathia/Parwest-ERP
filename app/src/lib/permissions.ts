/**
 * Permission & Role Management Utilities
 * Mock implementation for frontend-only testing
 * TODO: Replace with Supabase RLS + user profile queries in Phase 8
 */

export type UserRole = 'admin' | 'operations_manager' | 'hr_manager' | 'finance_manager' | 'supervisor' | 'guard';

export type Module =
    | 'dashboard'
    | 'guards'
    | 'clients'
    | 'deployments'
    | 'attendance'
    | 'payroll'
    | 'billing'
    | 'inventory'
    | 'tickets'
    | 'reports'
    | 'settings';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

/**
 * Mock user session - replace with Supabase auth in Phase 8
 */
export function getCurrentUser() {
    // For testing: return mock user based on localStorage or default to admin
    if (typeof window !== 'undefined') {
        const mockRole = localStorage.getItem('mock_user_role') as UserRole;
        return {
            id: 'mock-user-1',
            email: 'admin@parwest.com',
            role: mockRole || 'admin',
            name: 'Admin User'
        };
    }
    return {
        id: 'mock-user-1',
        email: 'admin@parwest.com',
        role: 'admin' as UserRole,
        name: 'Admin User'
    };
}

/**
 * Permission matrix - defines what each role can do
 */
const PERMISSIONS: Record<UserRole, Record<Module, Action[]>> = {
    admin: {
        dashboard: ['view', 'export'],
        guards: ['view', 'create', 'edit', 'delete', 'approve'],
        clients: ['view', 'create', 'edit', 'delete'],
        deployments: ['view', 'create', 'edit', 'delete'],
        attendance: ['view', 'create', 'edit', 'approve', 'export'],
        payroll: ['view', 'create', 'edit', 'approve', 'export'],
        billing: ['view', 'create', 'edit', 'delete', 'export'],
        inventory: ['view', 'create', 'edit', 'delete'],
        tickets: ['view', 'create', 'edit', 'delete'],
        reports: ['view', 'export'],
        settings: ['view', 'create', 'edit', 'delete'],
    },
    operations_manager: {
        dashboard: ['view'],
        guards: ['view', 'create', 'edit'],
        clients: ['view', 'create', 'edit'],
        deployments: ['view', 'create', 'edit', 'delete'],
        attendance: ['view', 'edit', 'export'],
        payroll: ['view'],
        billing: ['view'],
        inventory: ['view', 'create', 'edit'],
        tickets: ['view', 'create', 'edit'],
        reports: ['view', 'export'],
        settings: ['view'],
    },
    hr_manager: {
        dashboard: ['view'],
        guards: ['view', 'create', 'edit', 'approve'],
        clients: ['view'],
        deployments: ['view'],
        attendance: ['view', 'approve', 'export'],
        payroll: ['view', 'create', 'edit', 'approve', 'export'],
        billing: ['view'],
        inventory: ['view'],
        tickets: ['view', 'create', 'edit'],
        reports: ['view', 'export'],
        settings: ['view'],
    },
    finance_manager: {
        dashboard: ['view'],
        guards: ['view'],
        clients: ['view', 'edit'],
        deployments: ['view'],
        attendance: ['view', 'export'],
        payroll: ['view', 'approve', 'export'],
        billing: ['view', 'create', 'edit', 'delete', 'export'],
        inventory: ['view'],
        tickets: ['view', 'create'],
        reports: ['view', 'export'],
        settings: ['view'],
    },
    supervisor: {
        dashboard: ['view'],
        guards: ['view'],
        clients: ['view'],
        deployments: ['view'],
        attendance: ['view', 'create', 'edit'],
        payroll: ['view'],
        billing: ['view'],
        inventory: ['view'],
        tickets: ['view', 'create'],
        reports: ['view'],
        settings: ['view'],
    },
    guard: {
        dashboard: ['view'],
        guards: ['view'], // Own profile only
        clients: [],
        deployments: ['view'], // Own deployments only
        attendance: ['view'], // Own attendance only
        payroll: ['view'], // Own payslips only
        billing: [],
        inventory: ['view'],
        tickets: ['view', 'create'],
        reports: [],
        settings: ['view'],
    },
};

/**
 * Check if current user can perform an action on a module
 */
export function can(module: Module, action: Action): boolean {
    const user = getCurrentUser();
    const rolePermissions = PERMISSIONS[user.role];

    if (!rolePermissions || !rolePermissions[module]) {
        return false;
    }

    return rolePermissions[module].includes(action);
}

/**
 * Alias for can() - more semantic in some contexts
 */
export function hasPermission(module: Module, action: Action): boolean {
    return can(module, action);
}

/**
 * Get all permissions for current user's role
 */
export function getUserPermissions(): Record<Module, Action[]> {
    const user = getCurrentUser();
    return PERMISSIONS[user.role];
}

/**
 * Check if user has any of the specified roles
 */
export function hasRole(...roles: UserRole[]): boolean {
    const user = getCurrentUser();
    return roles.includes(user.role);
}

/**
 * Get role-specific dashboard route
 */
export function getRoleDashboardRoute(role?: UserRole): string {
    const userRole = role || getCurrentUser().role;

    switch (userRole) {
        case 'admin':
        case 'operations_manager':
            return '/dashboard';
        case 'hr_manager':
            return '/guards';
        case 'finance_manager':
            return '/billing/invoices';
        case 'supervisor':
            return '/deployments';
        case 'guard':
            return '/dashboard'; // Limited view
        default:
            return '/dashboard';
    }
}
