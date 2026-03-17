export type ReportBinding = {
    endpoint: string
    fields: Array<{
        key: string
        label: string
        type?: "text" | "date" | "month"
        options?: string[]
    }>
}

export const REPORT_BINDINGS: Record<string, ReportBinding> = {
    scheduled: {
        endpoint: "/api/reports/scheduled",
        fields: [
            { key: "reportType", label: "Report Type" },
            { key: "frequency", label: "Frequency", options: ["DAILY", "WEEKLY", "MONTHLY"] },
            { key: "status", label: "Status", options: ["ACTIVE", "PAUSED"] },
        ],
    },
    scheduledreports: {
        endpoint: "/api/reports/scheduled",
        fields: [
            { key: "reportType", label: "Report Type" },
            { key: "frequency", label: "Frequency", options: ["DAILY", "WEEKLY", "MONTHLY"] },
            { key: "status", label: "Status", options: ["ACTIVE", "PAUSED"] },
        ],
    },
    "guard-deployment": {
        endpoint: "/api/reports/guards/deployment",
        fields: [
            { key: "startDate", label: "Start Date", type: "date" },
            { key: "endDate", label: "End Date", type: "date" },
            { key: "regionalOfficeId", label: "Regional Office ID" },
            { key: "clientType", label: "Client Type" },
            { key: "clientId", label: "Client ID" },
        ],
    },
    guardDeploymentreports: {
        endpoint: "/api/reports/guards/deployment",
        fields: [
            { key: "startDate", label: "Start Date", type: "date" },
            { key: "endDate", label: "End Date", type: "date" },
            { key: "regionalOfficeId", label: "Regional Office ID" },
            { key: "clientType", label: "Client Type" },
            { key: "clientId", label: "Client ID" },
        ],
    },
    "day-night-duty": {
        endpoint: "/api/reports/guards/day-night-duty",
        fields: [
            { key: "dateFrom", label: "Date From", type: "date" },
            { key: "dateTo", label: "Date To", type: "date" },
            { key: "regionalOfficeId", label: "Regional Office ID" },
            { key: "clientType", label: "Client Type" },
            { key: "clientId", label: "Client ID" },
            { key: "reportType", label: "Report Type", options: ["DAY", "NIGHT", "BOTH"] },
        ],
    },
    dayNightDutyGuards: {
        endpoint: "/api/reports/guards/day-night-duty",
        fields: [
            { key: "dateFrom", label: "Date From", type: "date" },
            { key: "dateTo", label: "Date To", type: "date" },
            { key: "regionalOfficeId", label: "Regional Office ID" },
            { key: "clientType", label: "Client Type" },
            { key: "clientId", label: "Client ID" },
            { key: "reportType", label: "Report Type", options: ["DAY", "NIGHT", "BOTH"] },
        ],
    },
    "client-enrolled": {
        endpoint: "/api/reports/clients/enrolled",
        fields: [
            { key: "startDate", label: "Start Date", type: "date" },
            { key: "endDate", label: "End Date", type: "date" },
            { key: "regionId", label: "Region ID" },
            { key: "clientType", label: "Client Type" },
            { key: "status", label: "Status", options: ["ACTIVE", "INACTIVE", "BLACKLISTED"] },
        ],
    },
    clientEnrolledreports: {
        endpoint: "/api/reports/clients/enrolled",
        fields: [
            { key: "startDate", label: "Start Date", type: "date" },
            { key: "endDate", label: "End Date", type: "date" },
            { key: "regionId", label: "Region ID" },
            { key: "clientType", label: "Client Type" },
            { key: "status", label: "Status", options: ["ACTIVE", "INACTIVE", "BLACKLISTED"] },
        ],
    },
    "client-summary": {
        endpoint: "/api/reports/clients/summary",
        fields: [
            { key: "month", label: "Month", type: "month" },
            { key: "regionId", label: "Region ID" },
            { key: "clientType", label: "Client Type" },
            { key: "clientId", label: "Client ID" },
        ],
    },
    "inventory-store-summary": {
        endpoint: "/api/reports/inventory/store-summary",
        fields: [
            { key: "regionalOfficeId", label: "Regional Office ID" },
            { key: "storeId", label: "Store ID" },
            { key: "productId", label: "Product ID" },
            { key: "search", label: "Search" },
        ],
    },
}

export function isOperationalReportScreen(screen: string) {
    return Boolean(REPORT_BINDINGS[screen])
}
