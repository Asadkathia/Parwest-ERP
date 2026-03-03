"use client"

import { Calendar, CheckCircle, XCircle, Clock } from "lucide-react"
import type { AttendanceRecord, AttendanceSummary } from "@/components/guards/tabs/types"

interface AttendanceTabProps {
    attendance: AttendanceRecord[]
    attendanceSummary: AttendanceSummary
}

export default function AttendanceTab({ attendance, attendanceSummary }: AttendanceTabProps) {
    const getStatusIcon = (status: string) => {
        switch (status) {
            case "PRESENT":
                return <CheckCircle className="h-4 w-4 text-green-600" />
            case "ABSENT":
                return <XCircle className="h-4 w-4 text-red-600" />
            default:
                return <Clock className="h-4 w-4 text-gray-600" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "PRESENT":
                return "bg-green-100 text-green-800"
            case "ABSENT":
                return "bg-red-100 text-red-800"
            default:
                return "bg-gray-100 text-gray-800"
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Attendance</h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Export Report
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border p-4">
                    <p className="text-sm text-gray-600">Total Days</p>
                    <p className="text-2xl font-bold mt-1">{attendanceSummary.totalDays}</p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                    <p className="text-sm text-gray-600">Present</p>
                    <p className="text-2xl font-bold mt-1 text-green-600">{attendanceSummary.present}</p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                    <p className="text-sm text-gray-600">Absent</p>
                    <p className="text-2xl font-bold mt-1 text-red-600">{attendanceSummary.absent}</p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                    <p className="text-sm text-gray-600">Overtime Hours</p>
                    <p className="text-2xl font-bold mt-1 text-blue-600">{attendanceSummary.overtime}</p>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white rounded-lg border">
                <div className="p-4 border-b">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Attendance Records
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Shift
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Hours
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Remarks
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {attendance.map((record, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {new Date(record.date).toLocaleDateString("en-US", {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                                            {getStatusIcon(record.status)}
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {record.shift}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {record.hours} {record.overtime ? `(+${record.overtime} OT)` : ""}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {record.reason || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
