"use client"

import { DollarSign, Download } from "lucide-react"

import {
    Card,
    CardContent,
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
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import { TabStatusBadge } from "@/components/guards/tabs/status-badge"
import type { PaidSalaryRecord } from "@/components/guards/tabs/types"

interface PaidSalariesTabProps {
    salaries: PaidSalaryRecord[]
}

export default function PaidSalariesTab({ salaries }: PaidSalariesTabProps) {
    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-20 font-bold">Paid Salaries</h2>
                    <p className="text-sm text-muted-foreground">Historical salary disbursements.</p>
                </div>
                <Button>Export Salary History</Button>
            </div>

            {salaries.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No salary records found</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead>Gross Amount</TableHead>
                                    <TableHead>Deductions</TableHead>
                                    <TableHead>Net Amount</TableHead>
                                    <TableHead>Payment Method</TableHead>
                                    <TableHead>Paid On</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salaries.map((salary, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium whitespace-nowrap">
                                            {salary.month}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            <ParwestCurrency value={salary.amount} compact={false} />
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            <ParwestCurrency value={-Math.abs(salary.deductions)} compact={false} />
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap font-semibold text-emerald-600 dark:text-emerald-400">
                                            <ParwestCurrency value={salary.netAmount} compact={false} />
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {salary.method}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap tabular-nums">
                                            {formatDate(salary.paidOn)}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            <TabStatusBadge label={salary.status} status={salary.status} />
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            <Button variant="link" size="sm" className="px-0 h-auto">
                                                <Download className="h-4 w-4" />
                                                Slip
                                            </Button>
                                        </TableCell>
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
