"use client"

import { GraduationCap } from "lucide-react"

interface OnJobTrainingsTabProps {
    trainings: any[]
}

export default function OnJobTrainingsTab({ trainings }: OnJobTrainingsTabProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">OnJob Trainings</h2>
                <div className="text-sm text-gray-600">
                    Sessions: <span className="font-semibold">{trainings.length}</span>
                </div>
            </div>

            {trainings.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No training sessions found</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conducted By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supervisor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topics</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {trainings.map((training) => (
                                <tr key={training.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                                        {training.date
                                            ? new Date(training.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                            : "—"}
                                    </td>
                                    <td className="px-6 py-4 text-sm">{training.location || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{training.conductedBy || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{training.supervisor || "—"}</td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{training.topics || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

