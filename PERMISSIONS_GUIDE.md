# Permission System Usage Guide

## Quick Start

The Guard Management ERP includes a role-based permission system for controlling access to features.

## Available Roles

- **admin** - Full system access
- **operations_manager** - Deployments, guards, attendance
- **hr_manager** - Guards, payroll, attendance approval
- **finance_manager** - Billing, payroll approval
- **supervisor** - Field operations, attendance entry
- **guard** - View own profile and schedules

## Using Permissions in Components

### Basic Permission Check

```tsx
import { usePermission } from '@/lib/hooks/use-permissions';

function MyComponent() {
    const canEdit = usePermission('guards', 'edit');
    
    return (
        <Button disabled={!canEdit}>
            Edit Guard
        </Button>
    );
}
```

### Protected Button

```tsx
import { ProtectedButton } from '@/components/ui/protected-button';

function MyComponent() {
    return (
        <ProtectedButton 
            module="guards" 
            action="create"
            onClick={handleCreate}
        >
            Add New Guard
        </ProtectedButton>
    );
}
```

### Multiple Permission Checks

```tsx
import { usePermissions } from '@/lib/hooks/use-permissions';

function MyComponent() {
    const { canView, canEdit, canDelete } = usePermissions('guards', ['view', 'edit', 'delete']);
    
    return (
        <div>
            {canView && <ViewButton />}
            {canEdit && <EditButton />}
            {canDelete && <DeleteButton />}
        </div>
    );
}
```

### Role-Based Rendering

```tsx
import { useHasRole } from '@/lib/hooks/use-permissions';

function AdminPanel() {
    const isAdmin = useHasRole('admin', 'operations_manager');
    
    if (!isAdmin) return null;
    
    return <div>Admin Controls</div>;
}
```

## Server-Side Permissions

```tsx
import { can, getCurrentUser } from '@/lib/permissions';

export default function Page() {
    const user = getCurrentUser();
    const canApprove = can('payroll', 'approve');
    
    return (
        <div>
            <h1>Welcome, {user.name}</h1>
            {canApprove && <ApprovalSection />}
        </div>
    );
}
```

## Testing Different Roles

In development, you can switch roles by setting localStorage:

```javascript
// In browser console
localStorage.setItem('mock_user_role', 'hr_manager');
// Refresh page
```

Available test roles:
- `admin`
- `operations_manager`
- `hr_manager`
- `finance_manager`
- `supervisor`
- `guard`

## Permission Matrix

| Module | Admin | Ops Mgr | HR Mgr | Finance | Supervisor | Guard |
|--------|-------|---------|--------|---------|------------|-------|
| Guards | Full | Create/Edit | Full | View | View | Own Only |
| Payroll | Full | View | Full | Approve | View | Own Only |
| Billing | Full | View | View | Full | View | - |
| Deployments | Full | Full | View | View | View | Own Only |
| Attendance | Full | Edit | Approve | View | Entry | Own Only |

## Next Steps (Phase 8)

The current implementation uses mock data. In Phase 8, this will be connected to:
- Supabase user profiles
- Row-Level Security (RLS) policies
- Real-time permission updates
