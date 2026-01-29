'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sidebar, TopBar } from '@/components/layout';

interface AppShellProps {
    children: React.ReactNode;
    contextSidebar?: React.ReactNode;
}

export function AppShell({ children, contextSidebar }: AppShellProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

    return (
        <div className="min-h-screen bg-background">
            {/* Sidebar */}
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content Area */}
            <div
                className={cn(
                    'flex flex-col transition-all duration-300',
                    sidebarCollapsed ? 'ml-[68px]' : 'ml-60'
                )}
            >
                {/* Top Bar */}
                <TopBar notificationCount={3} />

                {/* Main + Context Sidebar */}
                <div className="flex flex-1">
                    {/* Main Workspace */}
                    <main className="flex-1 p-6 overflow-auto">
                        {children}
                    </main>

                    {/* Context Sidebar (Right Panel) */}
                    {contextSidebar}
                </div>
            </div>
        </div>
    );
}
