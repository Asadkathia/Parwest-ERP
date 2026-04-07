"use client"

import { User, Phone, MapPin, Building, Briefcase, BookOpen, UserCheck, Activity } from "lucide-react"
import type { GuardTabModel, NearestRelative, FamilyMember } from "@/components/guards/tabs/types"

interface GeneralInformationProps {
    guard: GuardTabModel
}

function InfoField({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="font-medium text-gray-900">{value || "—"}</p>
        </div>
    )
}

export default function GeneralInformationTab({ guard }: GeneralInformationProps) {
    const formatDate = (date?: Date | string | null) => {
        if (!date) return "—"
        return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    }

    const formatTime = (date?: Date | string | null) => {
        if (!date) return "—"
        const d = new Date(date)
        return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    }

    const calculateCurrentAge = (dob?: Date | string | null): string | null => {
        if (!dob) return null
        const birth = new Date(dob)
        const today = new Date()
        let years = today.getFullYear() - birth.getFullYear()
        const m = today.getMonth() - birth.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--
        return `${years} years`
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "ACTIVE": return "bg-green-100 text-green-800"
            case "INACTIVE": return "bg-gray-100 text-gray-800"
            case "PENDING": return "bg-yellow-100 text-yellow-800"
            default: return "bg-gray-100 text-gray-800"
        }
    }

    const nearestRelativeList = Array.isArray(guard.nearestRelatives) ? guard.nearestRelatives : []
    const familyMemberList = Array.isArray(guard.familyMembers) ? guard.familyMembers : []

    // Previous employment label
    const exType = guard.exServiceType || (guard.isExService ? "OTHER" : "CIVILIAN")
    const isPreviouslyServed = ["ARMY", "POLICE", "RANGERS", "MUJAHID", "OTHER"].includes(exType)
    const exLabel = exType === "OTHER" ? (guard.exServiceOtherLabel || "Other") : exType

    return (
        <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">General Information</h2>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(guard.status || "PENDING")}`}>
                    {guard.status || "PENDING"}
                </span>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="Parwest ID" value={guard.parwestId} />
                    <InfoField label="Full Name" value={guard.name} />
                    <InfoField label="CNIC" value={guard.cnic} />
                    <InfoField label="CNIC Issue Date" value={formatDate(guard.cnicIssueDate)} />
                    <InfoField label="CNIC Expiry Date" value={formatDate(guard.cnicExpiryDate)} />
                    <InfoField label="Father's Name" value={guard.fatherName} />
                    <InfoField label="Mother's Name" value={guard.motherName} />
                    <InfoField label="Date of Birth" value={formatDate(guard.dateOfBirth)} />
                    <InfoField label="Current Age" value={calculateCurrentAge(guard.dateOfBirth)} />
                    <InfoField label="Religion" value={guard.religion} />
                    <InfoField label="Sect" value={guard.sect} />
                    <InfoField label="Cast" value={guard.cast} />
                    <InfoField label="Marital Status" value={guard.maritalStatus} />
                    <InfoField label="Blood Group" value={guard.bloodGroup} />
                    <InfoField label="Nationality" value={guard.nationality} />
                    <InfoField label="Next of Kin" value={guard.nextOfKin} />
                    <InfoField label="Police Station" value={guard.policeStation} />
                    <InfoField label="Profile Introducer" value={guard.profileIntroducer} />
                    <InfoField label="Enrolled By" value={guard.enrolledBy} />
                    <InfoField label="Enrolled Date" value={formatDate(guard.createdAt)} />
                    <InfoField label="Enrolled Time" value={formatTime(guard.createdAt)} />
                </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="Phone" value={guard.phone} />
                    <InfoField label="Email" value={guard.email} />
                    <InfoField label="Emergency Contact" value={guard.emergencyContact} />
                    <div className="md:col-span-2 lg:col-span-3">
                        <InfoField label="Additional Contact Numbers" value={guard.additionalContactNumbers || guard.phoneSecondary} />
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
                    <InfoField label="Current Address" value={guard.addressCurrent} />
                    <InfoField label="Current Address Contact" value={guard.currentAddressContact} />
                    <InfoField label="Permanent Address" value={guard.addressPermanent} />
                    <InfoField label="Permanent Address Contact" value={guard.permanentAddressContact} />
                </div>
            </div>

            {/* Parwest Employment */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Parwest Employment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="Regional Office" value={typeof guard.regionalOffice === "string" ? guard.regionalOffice : guard.regionalOffice?.name} />
                    <InfoField label="Designation" value={guard.designation} />
                    <InfoField label="Salary" value={guard.salary != null ? `PKR ${guard.salary.toLocaleString()}` : null} />
                    <InfoField label="Supervisor" value={guard.managerName} />
                    <InfoField label="Enrolled By" value={guard.enrolledBy} />
                    <InfoField label="Joining Date" value={formatDate(guard.joiningDate)} />
                    <InfoField label="Joining Age" value={guard.joiningAge != null ? `${guard.joiningAge} years` : null} />
                </div>
            </div>

            {/* Previous Employment */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Previous Employment
                </h3>
                {(() => {
                    const multiEntries = Array.isArray(guard.previousEmployments) && guard.previousEmployments.length > 0
                        ? guard.previousEmployments
                        : null

                    // Build display entries — prefer multi-entry JSON, fall back to flat fields
                    const entries = multiEntries ?? (isPreviouslyServed ? [{
                        type: exLabel,
                        isExService: true,
                        registrationNo: guard.exServiceRegistrationNo,
                        rank: guard.exServiceRank,
                        unit: guard.exServiceUnit || guard.exServiceRegiment,
                        dateOfEnrollment: guard.dateOfEnrollment ? String(guard.dateOfEnrollment) : null,
                        dateOfDischarge: guard.dateOfDischarge ? String(guard.dateOfDischarge) : null,
                        years: guard.exServiceYears,
                        months: guard.exServiceMonths,
                        remarks: guard.exServiceRemarks,
                    }] : [])

                    if (entries.length === 0) {
                        return (
                            <div className="flex items-center gap-2 rounded-md bg-gray-50 border px-4 py-3">
                                <span className="text-sm font-medium text-gray-700">Type:</span>
                                <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-sm font-medium">Civilian</span>
                            </div>
                        )
                    }

                    return (
                        <div className="space-y-6">
                            {entries.map((emp, idx) => {
                                const yearsNum = emp.years != null ? parseInt(String(emp.years)) : null
                                const monthsNum = emp.months != null ? parseInt(String(emp.months)) : null
                                const serviceDuration = [
                                    yearsNum ? `${yearsNum} year${yearsNum !== 1 ? "s" : ""}` : null,
                                    monthsNum ? `${monthsNum} month${monthsNum !== 1 ? "s" : ""}` : null,
                                ].filter(Boolean).join(" ") || null

                                const enrollDate = formatDate(emp.dateOfEnrollment)
                                const dischargeDate = formatDate(emp.dateOfDischarge)
                                const servicePeriod = enrollDate !== "—" || dischargeDate !== "—"
                                    ? `${enrollDate} → ${dischargeDate}`
                                    : null

                                const isCivilian = emp.type === "CIVILIAN" || emp.isExService === false
                                const empLoose = emp as Record<string, unknown>

                                return (
                                    <div key={idx} className={entries.length > 1 ? "rounded-md border p-4" : ""}>
                                        {entries.length > 1 && (
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Employment {idx + 1}</p>
                                        )}
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-sm font-medium text-gray-700">Employment Type:</span>
                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${isCivilian ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                                                {emp.type || "—"}
                                            </span>
                                        </div>
                                        {isCivilian ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <InfoField label="Company Name" value={empLoose.nameOfCompany as string | null | undefined} />
                                                <InfoField label="Designation" value={empLoose.designation as string | null | undefined} />
                                                <InfoField label="Service Period" value={servicePeriod} />
                                                <InfoField label="Duration" value={serviceDuration} />
                                                <InfoField label="Reason for Leaving" value={empLoose.reasonForLeaving as string | null | undefined} />
                                                <InfoField label="Remarks" value={emp.remarks} />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <InfoField label="Registration No" value={emp.registrationNo} />
                                                <InfoField label="Rank" value={emp.rank} />
                                                <InfoField label="Unit / Regiment" value={emp.unit} />
                                                <InfoField label="Service Period" value={servicePeriod} />
                                                <InfoField label="Duration of Service" value={serviceDuration} />
                                                <InfoField label="Remarks" value={emp.remarks} />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )
                })()}
            </div>

            {/* Education */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Education
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="Education Level" value={guard.education} />
                    <InfoField label="Passing Year" value={guard.passingYear} />
                    <InfoField label="Institute" value={guard.educationInstitute} />
                </div>
            </div>

            {/* Physical Details */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Physical Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="Height" value={guard.height} />
                    <InfoField label="Weight" value={guard.weight} />
                    <InfoField label="Eye Color" value={guard.eyeColor} />
                    <InfoField label="Hair Color" value={guard.hairColor} />
                    <InfoField label="Disability" value={guard.disability} />
                    <InfoField label="Mark of Identification" value={guard.identificationMark} />
                </div>
            </div>

            {/* Introducer */}
            {(guard.introducerName || guard.introducerCnic) ? (
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <UserCheck className="h-5 w-5" />
                        Introducer
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <InfoField label="Full Name" value={guard.introducerName} />
                        <InfoField label="CNIC" value={guard.introducerCnic} />
                        <InfoField label="Contact" value={guard.introducerContact} />
                        <div className="md:col-span-2">
                            <InfoField label="Address" value={guard.introducerAddress} />
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Family Members */}
            {familyMemberList.length > 0 ? (
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold mb-4">Family Members</h3>
                    <div className="space-y-3">
                        {familyMemberList.map((member: FamilyMember, i: number) => (
                            <div key={i} className="rounded-md border p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                <InfoField label="Name" value={member.name} />
                                <InfoField label="Relation" value={member.relation} />
                                <InfoField label="Age" value={member.age} />
                                <InfoField label="Profession" value={member.profession} />
                                {member.address ? <div className="md:col-span-2 lg:col-span-4"><InfoField label="Address" value={member.address} /></div> : null}
                                {member.childCnic ? <InfoField label="Child CNIC / B-Form" value={member.childCnic} /> : null}
                                {member.childAge ? <InfoField label="Child Age" value={member.childAge} /> : null}
                                {member.childDob ? <InfoField label="Child DOB" value={member.childDob} /> : null}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Nearest Relatives */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">Nearest Relative Details</h3>
                {nearestRelativeList.length === 0 ? (
                    <p className="text-sm text-gray-600">No nearest relative details available.</p>
                ) : (
                    <div className="space-y-4">
                        {nearestRelativeList.map((relative: NearestRelative, index: number) => (
                            <div key={`${relative.name || "relative"}-${index}`} className="rounded-md border p-4">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                                    <InfoField label="Name" value={relative.name} />
                                    <InfoField label="Father Name" value={relative.fatherName} />
                                    <InfoField label="Relation" value={relative.relation} />
                                    <InfoField label="Profession" value={relative.profession} />
                                    <InfoField label="CNIC" value={relative.cnic} />
                                    <InfoField label="Contact" value={relative.contact} />
                                    <div className="md:col-span-2">
                                        <InfoField label="Address" value={relative.address} />
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
