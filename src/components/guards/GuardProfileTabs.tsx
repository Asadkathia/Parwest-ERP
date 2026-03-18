"use client"

import { useSearchParams } from "next/navigation"
import TabNavigation, { Tab } from "@/components/ui/TabNavigation"
import GeneralInformationTab from "@/components/guards/tabs/GeneralInformationTab"
import ProfileTab from "@/components/guards/tabs/ProfileTab"
import AttachmentsTab from "@/components/guards/tabs/AttachmentsTab"
import AttendanceTab from "@/components/guards/tabs/AttendanceTab"
import InventoryTab from "@/components/guards/tabs/InventoryTab"
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
import PBADocumentsTab from "@/components/guards/tabs/PBADocumentsTab"
import type { GuardTabModel } from "@/components/guards/tabs/types"
import {
    User,
    FileText,
    Paperclip,
    Calendar,
    Package,
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
} from "lucide-react"

interface GuardProfileTabsProps {
    guard: GuardTabModel & { id?: string }
    baseUrl: string
}

const tabs: Tab[] = [
    { id: "general", label: "General Information", icon: User },
    { id: "profile", label: "Profile", icon: FileText },
    { id: "attachments", label: "Attachments", icon: Paperclip },
    { id: "attendance", label: "Attendance", icon: Calendar },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "salaries", label: "Paid Salaries", icon: DollarSign },
    { id: "deployments", label: "Deployment History", icon: MapPin },
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "verification", label: "Verification", icon: CheckCircle },
    { id: "pledged-docs", label: "Pledged Documents", icon: FileText },
    { id: "bank-details", label: "Bank Details", icon: CreditCard },
    { id: "residence-history", label: "Residence History", icon: Home },
    { id: "ojt", label: "OnJob Trainings", icon: GraduationCap },
    { id: "store-inventory", label: "Store Inventory", icon: ShoppingCart },
    { id: "service-history", label: "Service History", icon: History },
    { id: "insurance", label: "Insurance", icon: Shield },
    { id: "status-history", label: "Status History", icon: Activity },
    { id: "pba-docs", label: "PBA Documents", icon: FileText },
]

export default function GuardProfileTabs({ guard, baseUrl }: GuardProfileTabsProps) {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "general"

    const renderTabContent = () => {
        switch (activeTab) {
            case "general":
                return <GeneralInformationTab guard={guard} />
            case "profile":
                return <ProfileTab guard={guard} />
            case "attachments":
                return <AttachmentsTab guardId={guard.id || ""} />
            case "attendance":
                return <AttendanceTab attendance={guard.attendance || []} attendanceSummary={guard.attendanceSummary || {}} />
            case "inventory":
                return <InventoryTab inventory={guard.inventory || []} />
            case "salaries":
                return <PaidSalariesTab salaries={guard.salaries || []} />
            case "deployments":
                return <DeploymentHistoryTab deployments={guard.deployments || []} />
            case "courses":
                return <CoursesTab courses={guard.courses || []} />
            case "verification":
                return <VerificationTab guardId={guard.id || ""} />
            case "pledged-docs":
                return <PledgedDocumentsTab guardId={guard.id || ""} />
            case "bank-details":
                return <BankDetailsTab bankDetails={guard.bankDetails || {}} />
            case "residence-history":
                return <ResidenceHistoryTab residenceHistory={guard.residenceHistory || []} />
            case "ojt":
                return <OnJobTrainingsTab trainings={guard.ojtTrainings || []} />
            case "store-inventory":
                return <StoreInventoryTab items={guard.storeInventory || []} />
            case "service-history":
                return <ServiceHistoryTab serviceHistory={guard.serviceHistory || []} />
            case "insurance":
                return <InsuranceTab insurance={guard.insurance || []} />
            case "status-history":
                return <StatusHistoryTab statusHistory={guard.statusHistory || []} />
            case "pba-docs":
                return <PBADocumentsTab guard={guard} />
            default:
                return <GeneralInformationTab guard={guard} />
        }
    }

    return (
        <div>
            <TabNavigation tabs={tabs} baseUrl={baseUrl} />
            {renderTabContent()}
        </div>
    )
}
