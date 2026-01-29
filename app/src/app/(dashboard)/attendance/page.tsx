import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Download, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { AttendanceStats } from '@/components/attendance/attendance-stats';
import { BranchAttendanceTable } from '@/components/attendance/branch-attendance-table';
import { AttendanceExceptions } from '@/components/attendance/attendance-exceptions';

export const metadata: Metadata = {
    title: 'Attendance',
    description: 'Manage attendance records',
};

export default function AttendancePage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Attendance Dashboard"
                description="Daily tracking, roster verification, and exception management"
                breadcrumbs={[{ label: 'Attendance' }]}
                actions={
                    <>
                        <Button variant="outline">
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            Today: Jan 30, 2026
                        </Button>
                        <Button variant="outline">
                            <Filter className="h-4 w-4 mr-2" />
                            Filters
                        </Button>
                        <Button>
                            <Download className="h-4 w-4 mr-2" />
                            Export Report
                        </Button>
                    </>
                }
            />

            {/* KPI Stats */}
            <AttendanceStats />

            {/* Main Content Layout */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Branch Table - Takes up 2/3 width */}
                <div className="md:col-span-2">
                    <BranchAttendanceTable />
                </div>

                {/* Exceptions Panel - Takes up 1/3 width */}
                <div className="md:col-span-1">
                    <AttendanceExceptions />
                </div>
            </div>
        </div>
    );
}
