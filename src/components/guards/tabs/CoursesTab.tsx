"use client"

import { BookOpen, Award } from "lucide-react"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type CourseRecord = {
    id: string
    name?: string
    provider?: string
    completedDate?: string
}

interface CoursesTabProps {
    courses: GuardLooseRow[]
}

export default function CoursesTab({ courses }: CoursesTabProps) {
    const rows = courses as CourseRecord[]
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Courses</h2>
                <div className="text-sm text-gray-600">
                    Completed: <span className="font-semibold">{rows.length}</span>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No courses found</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Certificate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {rows.map((course) => (
                                <tr key={course.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium">{course.name}</td>
                                    <td className="px-6 py-4 text-sm">{course.provider}</td>
                                    <td className="px-6 py-4 text-sm">
                                        {course.completedDate
                                            ? new Date(course.completedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                            : "—"}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <button className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                                            <Award className="h-4 w-4" />
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
