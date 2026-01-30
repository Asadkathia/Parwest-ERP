import { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, QrCode } from 'lucide-react';
import { InventoryStats } from '@/components/inventory/inventory-stats';
import { InventoryTable } from '@/components/inventory/inventory-table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export const metadata: Metadata = {
    title: 'Inventory',
    description: 'Manage assets and equipment',
};

export default function InventoryPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Inventory & Assets"
                description="Track weapons, uniforms, and equipment"
                breadcrumbs={[{ label: 'Inventory' }]}
                actions={
                    <>
                        <Button variant="outline">
                            <QrCode className="h-4 w-4 mr-2" />
                            Scan Asset
                        </Button>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add New Asset
                        </Button>
                    </>
                }
            />

            {/* Inventory KPI Stats */}
            <InventoryStats />

            {/* Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-2 w-full md:w-auto">
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="weapons">Weapons</SelectItem>
                            <SelectItem value="uniforms">Uniforms</SelectItem>
                            <SelectItem value="electronics">Electronics</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="deployed">Deployed</SelectItem>
                            <SelectItem value="maintenance">In Maintenance</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search asset name or serial..." className="pl-10 w-full md:w-[250px]" />
                </div>
            </div>

            {/* Main Inventory Table */}
            <InventoryTable />
        </div>
    );
}
