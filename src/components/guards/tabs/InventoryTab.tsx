"use client"

import { Package } from "lucide-react"
import Link from "next/link"

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/shadcn/card"
import { Button } from "@/components/shadcn/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/shadcn/table"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type InventoryItem = {
    id: string
    item?: string
    category?: string
    serialNumber?: string
    issuedDate?: string
    condition?: string
}

interface InventoryTabProps {
    inventory: GuardLooseRow[]
}

export default function InventoryTab({ inventory }: InventoryTabProps) {
    const items = inventory as InventoryItem[]
    const uniqueCategories = new Set(items.map((item) => item.category)).size

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-20 font-bold">Inventory</h2>
                    <p className="text-sm text-muted-foreground">
                        Items: <span className="font-semibold tabular-nums">{items.length}</span>
                    </p>
                </div>
                <Button asChild variant="secondary">
                    <Link href="/store-inventory/employee-assignments">Inventory V2</Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-normal text-muted-foreground">
                            Assigned Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums">{items.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-normal text-muted-foreground">
                            Item Categories
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums">{uniqueCategories}</p>
                    </CardContent>
                </Card>
            </div>

            {items.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No inventory assigned</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Serial</TableHead>
                                    <TableHead>Issued Date</TableHead>
                                    <TableHead>Condition</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.item}</TableCell>
                                        <TableCell>{item.category}</TableCell>
                                        <TableCell className="font-mono tabular-nums">{item.serialNumber || "—"}</TableCell>
                                        <TableCell className="tabular-nums">
                                            {item.issuedDate
                                                ? new Date(item.issuedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                                : "—"}
                                        </TableCell>
                                        <TableCell>{item.condition || "—"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
