'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye, Upload, AlertCircle } from 'lucide-react';

export function GuardDocuments() {
    const documents = [
        {
            id: '1',
            type: 'CNIC (Front)',
            name: 'cnic_front_3310012345671.jpg',
            uploaded_at: '2024-01-15',
            expiry: '2028-12-31',
            status: 'valid',
            size: '1.2 MB',
        },
        {
            id: '2',
            type: 'CNIC (Back)',
            name: 'cnic_back_3310012345671.jpg',
            uploaded_at: '2024-01-15',
            expiry: '2028-12-31',
            status: 'valid',
            size: '1.1 MB',
        },
        {
            id: '3',
            type: 'Police Verification',
            name: 'police_ver_lahore_2024.pdf',
            uploaded_at: '2024-01-20',
            expiry: '2025-01-20',
            status: 'expiring_soon',
            size: '2.4 MB',
        },
        {
            id: '4',
            type: 'Educational Certificate',
            name: 'matric_certificate.pdf',
            uploaded_at: '2024-01-15',
            expiry: null,
            status: 'valid',
            size: '3.5 MB',
        },
        {
            id: '5',
            type: 'Service Card',
            name: 'service_card_2023.jpg',
            uploaded_at: '2023-01-10',
            expiry: '2023-12-31',
            status: 'expired',
            size: '0.8 MB',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Digital Case File</h3>
                <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Document Type</TableHead>
                                <TableHead>File Name</TableHead>
                                <TableHead>Uploaded Date</TableHead>
                                <TableHead>Expiry Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {documents.map((doc) => (
                                <TableRow key={doc.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            {doc.type}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {doc.name}
                                        <span className="text-xs ml-2 opacity-70">({doc.size})</span>
                                    </TableCell>
                                    <TableCell>{doc.uploaded_at}</TableCell>
                                    <TableCell>
                                        {doc.expiry || <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell>
                                        {doc.status === 'valid' && (
                                            <Badge variant="outline" className="bg-success/5 text-success hover:bg-success/10 border-success/20">
                                                Valid
                                            </Badge>
                                        )}
                                        {doc.status === 'expiring_soon' && (
                                            <Badge variant="outline" className="bg-warning/5 text-warning hover:bg-warning/10 border-warning/20">
                                                Expiring Soon
                                            </Badge>
                                        )}
                                        {doc.status === 'expired' && (
                                            <Badge variant="outline" className="bg-destructive/5 text-destructive hover:bg-destructive/10 border-destructive/20">
                                                Expired
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Expiry Alerts */}
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 flex gap-3 text-warning-foreground">
                <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
                <div className="space-y-1">
                    <p className="font-medium text-sm text-warning">Action Required</p>
                    <p className="text-sm opacity-90">
                        Police Verification document is expiring in less than 30 days. Please request a new verification certificate.
                    </p>
                </div>
            </div>
        </div>
    );
}
