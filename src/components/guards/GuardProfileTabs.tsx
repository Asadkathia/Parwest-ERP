"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shadcn/tabs"
import GeneralInformationTab from "@/components/guards/tabs/GeneralInformationTab"
import ProfileTab from "@/components/guards/tabs/ProfileTab"
import AttachmentsTab from "@/components/guards/tabs/AttachmentsTab"
import AttendanceTab from "@/components/guards/tabs/AttendanceTab"
import PaidSalariesTab from "@/components/guards/tabs/PaidSalariesTab"
import DeploymentHistoryTab from "@/components/guards/tabs/DeploymentHistoryTab"
import CoursesTab from "@/components/guards/tabs/CoursesTab"
import VerificationTab from "@/components/guards/tabs/VerificationTab"
import PledgedDocumentsTab from "@/components/guards/tabs/PledgedDocumentsTab"
import BankDetailsTab from "@/components/guards/tabs/BankDetailsTab"
import ResidenceHistoryTab from "@/components/guards/tabs/ResidenceHistoryTab"
import OnJobTrainingsTab from "@/components/guards/tabs/OnJobTrainingsTab"
import StoreInventoryTab from "@/components/guards/tabs/StoreInventoryTab"
import ServiceHistoryTab from "@/components/guards/tabs/ServiceHistoryTab"
import InsuranceTab from "@/components/guards/tabs/InsuranceTab"
import StatusHistoryTab from "@/components/guards/tabs/StatusHistoryTab"
import StatutoryTab from "@/components/guards/tabs/StatutoryTab"
import PBADocumentsTab from "@/components/guards/tabs/PBADocumentsTab"
import ReserveLedgerPanel from "@/components/payroll/ReserveLedgerPanel"
import type { GuardTabModel } from "@/components/guards/tabs/types"
import {
    User,
    FileText,
    Paperclip,
    Calendar,
    DollarSign,
    MapPin,
    BookOpen,
    CheckCircle,
    CreditCard,
    Home,
    GraduationCap,
    ShoppingCart,
    History,
    Shield,
    Activity,
    Wallet,
    Receipt,
    type LucideIcon,
} from "lucide-react"

interface GuardProfileTabsProps {
    guard: GuardTabModel & { id?: string }
    baseUrl: string
    canCreate?: boolean
    canUpdate?: boolean
    canDelete?: boolean
}

type TabDef = { id: string; label: string; icon: LucideIcon }

// 18 tabs split into two rows. URL contract uses ?tab=<id>.
const tabRowOne: TabDef[] = [
    { id: "general", label: "General Information", icon: User },
    { id: "profile", label: "Profile", icon: FileText },
    { id: "attachments", label: "Attachments", icon: Paperclip },
    { id: "attendance", label: "Attendance", icon: Calendar },
    { id: "salaries", label: "Paid Salaries", icon: DollarSign },
    { id: "deployments", label: "Deployment History", icon: MapPin },
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "verification", label: "Verification", icon: CheckCircle },
    { id: "pledged-docs", label: "Pledged Documents", icon: FileText },
]

const tabRowTwo: TabDef[] = [
    { id: "bank-details", label: "Bank Details", icon: CreditCard },
    { id: "residence-history", label: "Residence History", icon: Home },
    { id: "ojt", label: "OnJob Trainings", icon: GraduationCap },
    { id: "store-inventory", label: "Store Inventory", icon: ShoppingCart },
    { id: "service-history", label: "Service History", icon: History },
    { id: "insurance", label: "Insurance", icon: Shield },
    { id: "status-history", label: "Status History", icon: Activity },
    { id: "pba-docs", label: "PBA Documents", icon: FileText },
    { id: "reserve", label: "Reserve", icon: Wallet },
    { id: "statutory", label: "Statutory (EOBI/ESSI)", icon: Receipt },
]

const allTabIds = new Set([...tabRowOne, ...tabRowTwo].map((t) => t.id))

export default function GuardProfileTabs({
    guard,
    baseUrl,
    canCreate = false,
    canUpdate = false,
    canDelete = false,
}: GuardProfileTabsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const rawTab = searchParams.get("tab") || "general"
    const activeTab = allTabIds.has(rawTab) ? rawTab : "general"

    const handleChange = (next: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", next)
        router.replace(`${baseUrl}?${params.toString()}`, { scroll: false })
    }

    const renderTrigger = (tab: TabDef) => {
        const Icon = tab.icon
        return (
            <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent px-3 py-3 text-sm font-medium text-gray-500 shadow-none transition-colors hover:text-gray-700 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
            >
                <Icon className="h-4 w-4" />
                {tab.label}
            </TabsTrigger>
        )
    }

    return (
        <Tabs value={activeTab} onValueChange={handleChange} className="w-full">
            {/* Underline tabs in two rows (18-tab guard profile style) */}
            <div className="border-b border-gray-200 mb-6">
                <TabsList className="-mb-px flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 text-muted-foreground">
                    {tabRowOne.map(renderTrigger)}
                </TabsList>
                <TabsList className="-mb-px flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 text-muted-foreground">
                    {tabRowTwo.map(renderTrigger)}
                </TabsList>
            </div>

            <TabsContent value="general" className="mt-0">
                <GeneralInformationTab guard={guard} canUpdate={canUpdate} />
            </TabsContent>
            <TabsContent value="profile" className="mt-0">
                <ProfileTab guard={guard} />
            </TabsContent>
            <TabsContent value="attachments" className="mt-0">
                <AttachmentsTab guardId={guard.id || ""} canCreate={canCreate} canDelete={canDelete} />
            </TabsContent>
            <TabsContent value="attendance" className="mt-0">
                <AttendanceTab
                    attendance={guard.attendance || []}
                    attendanceSummary={guard.attendanceSummary || {}}
                    deployments={(guard.deployments || []) as import("@/components/guards/tabs/types").DeploymentAuditRecord[]}
                    guardId={guard.id || ""}
                />
            </TabsContent>
            <TabsContent value="salaries" className="mt-0">
                <PaidSalariesTab salaries={guard.salaries || []} />
            </TabsContent>
            <TabsContent value="deployments" className="mt-0">
                <DeploymentHistoryTab deployments={guard.deployments || []} />
            </TabsContent>
            <TabsContent value="courses" className="mt-0">
                <CoursesTab courses={guard.courses || []} guardId={guard.id || ""} canCreate={canCreate} canDelete={canDelete} />
            </TabsContent>
            <TabsContent value="verification" className="mt-0">
                <VerificationTab guardId={guard.id || ""} canCreate={canCreate} canUpdate={canUpdate} />
            </TabsContent>
            <TabsContent value="pledged-docs" className="mt-0">
                <PledgedDocumentsTab guardId={guard.id || ""} canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} />
            </TabsContent>
            <TabsContent value="bank-details" className="mt-0">
                <BankDetailsTab bankDetails={guard.bankDetails || {}} guardId={guard.id || ""} canUpdate={canUpdate} />
            </TabsContent>
            <TabsContent value="residence-history" className="mt-0">
                <ResidenceHistoryTab residenceHistory={guard.residenceHistory || []} />
            </TabsContent>
            <TabsContent value="ojt" className="mt-0">
                <OnJobTrainingsTab
                    guardId={guard.id || ""}
                    canCreate={canCreate}
                    canDelete={canDelete}
                    guardRegionId={(guard as { regionId?: string | null }).regionId ?? null}
                    guardRegionalOfficeId={(guard as { regionalOfficeId?: string | null }).regionalOfficeId ?? null}
                />
            </TabsContent>
            <TabsContent value="store-inventory" className="mt-0">
                <StoreInventoryTab guardId={guard.id || ""} canCreate={canCreate} />
            </TabsContent>
            <TabsContent value="service-history" className="mt-0">
                <ServiceHistoryTab guardId={guard.id || ""} />
            </TabsContent>
            <TabsContent value="insurance" className="mt-0">
                <InsuranceTab insurance={guard.insurance || []} guardId={guard.id || ""} parwestId={guard.parwestId} canCreate={canCreate} canUpdate={canUpdate} />
            </TabsContent>
            <TabsContent value="status-history" className="mt-0">
                <StatusHistoryTab guardId={guard.id || ""} />
            </TabsContent>
            <TabsContent value="pba-docs" className="mt-0">
                <PBADocumentsTab guard={guard} />
            </TabsContent>
            <TabsContent value="reserve" className="mt-0">
                <ReserveLedgerPanel guardId={guard.id || ""} />
            </TabsContent>
            <TabsContent value="statutory" className="mt-0">
                <StatutoryTab guardId={guard.id || ""} />
            </TabsContent>
        </Tabs>
    )
}
