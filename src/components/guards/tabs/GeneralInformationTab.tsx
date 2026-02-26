"use client"

import { User, Mail, Phone, Calendar, MapPin, Building } from "lucide-react"

interface GeneralInformationProps {
    guard: any // Will be properly typed later
}

export default function GeneralInformationTab({ guard }: GeneralInformationProps) {
    const formatDate = (date: Date | string | null) => {
        if (!date) return "—"
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "ACTIVE":
                return "bg-green-100 text-green-800"
            case "INACTIVE":
                return "bg-gray-100 text-gray-800"
            case "PENDING":
                return "bg-yellow-100 text-yellow-800"
            default:
                return "bg-gray-100 text-gray-800"
        }
    }

    const nearestRelativeList = Array.isArray(guard.nearestRelatives) ? guard.nearestRelatives : []

    return (
        <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">General Information</h2>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(guard.status)}`}>
                    {guard.status}
                </span>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <p className="text-sm text-gray-600">Parwest ID</p>
                        <p className="font-medium">{guard.parwestId}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Full Name</p>
                        <p className="font-medium">{guard.name}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">CNIC</p>
                        <p className="font-medium">{guard.cnic}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Father's Name</p>
                        <p className="font-medium">{guard.fatherName || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Mother's Name</p>
                        <p className="font-medium">{guard.motherName || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Date of Birth</p>
                        <p className="font-medium">{formatDate(guard.dateOfBirth)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Age</p>
                        <p className="font-medium">{guard.age} years</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Religion</p>
                        <p className="font-medium">{guard.religion || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Marital Status</p>
                        <p className="font-medium">{guard.maritalStatus || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Education</p>
                        <p className="font-medium">{guard.education || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Nationality</p>
                        <p className="font-medium">{guard.nationality || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Next of Kin</p>
                        <p className="font-medium">{guard.nextOfKin || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Profile Introducer</p>
                        <p className="font-medium">{guard.profileIntroducer || "—"}</p>
                    </div>
                </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <p className="font-medium">{guard.phone || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium">{guard.email || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Emergency Contact</p>
                        <p className="font-medium">{guard.emergencyContact || "—"}</p>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                        <p className="text-sm text-gray-600">Additional Contact Numbers</p>
                        <p className="font-medium">
                            {guard.additionalContactNumbers || guard.phoneSecondary || "—"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Address Information */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Address Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-600">Permanent Address</p>
                        <p className="font-medium">{guard.addressPermanent || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Current Address</p>
                        <p className="font-medium">{guard.addressCurrent || "—"}</p>
                    </div>
                </div>
            </div>

            {/* Employment Information */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Employment Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <p className="text-sm text-gray-600">Regional Office</p>
                        <p className="font-medium">{guard.regionalOffice || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Manager</p>
                        <p className="font-medium">{guard.managerName || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Enrolled By User</p>
                        <p className="font-medium">{guard.enrolledBy || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Joining Date</p>
                        <p className="font-medium">{formatDate(guard.joiningDate)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Joining Age</p>
                        <p className="font-medium">{guard.joiningAge != null ? `${guard.joiningAge} years` : "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Ex-Service</p>
                        <p className="font-medium">{guard.isExService ? "Yes" : "No"}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">Nearest Relative Details</h3>
                {nearestRelativeList.length === 0 ? (
                    <p className="text-sm text-gray-600">No nearest relative details available.</p>
                ) : (
                    <div className="space-y-4">
                        {nearestRelativeList.map((relative: any, index: number) => (
                            <div key={`${relative.name || "relative"}-${index}`} className="rounded-md border p-4">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Name</p>
                                        <p className="font-medium">{relative.name || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Father Name</p>
                                        <p className="font-medium">{relative.fatherName || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Relation</p>
                                        <p className="font-medium">{relative.relation || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Profession</p>
                                        <p className="font-medium">{relative.profession || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">CNIC</p>
                                        <p className="font-medium">{relative.cnic || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Contact</p>
                                        <p className="font-medium">{relative.contact || "—"}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <p className="text-xs text-gray-500">Address</p>
                                        <p className="font-medium">{relative.address || "—"}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
