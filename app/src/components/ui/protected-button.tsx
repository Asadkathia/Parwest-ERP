'use client';

import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/hooks/use-permissions';
import { type Module, type Action } from '@/lib/permissions';

interface ProtectedButtonProps {
    module: Module;
    action: Action;
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
    disabledMessage?: string;
}

/**
 * Button component that respects user permissions
 * Automatically disables if user lacks permission
 * 
 * Usage:
 * <ProtectedButton module="guards" action="create" onClick={handleCreate}>
 *   Add Guard
 * </ProtectedButton>
 */
export function ProtectedButton({
    module,
    action,
    children,
    onClick,
    variant = 'default',
    size = 'default',
    className,
    disabledMessage = 'You do not have permission to perform this action'
}: ProtectedButtonProps) {
    const hasPermission = usePermission(module, action);

    return (
        <Button
            variant={variant}
            size={size}
            className={className}
            disabled={!hasPermission}
            onClick={hasPermission ? onClick : undefined}
            title={!hasPermission ? disabledMessage : undefined}
        >
            {children}
        </Button>
    );
}

