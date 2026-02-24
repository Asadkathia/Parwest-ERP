import type { UiSection, UiTable } from "@/components/parity/UiDocScreen"

export type ScreenConfig = {
  title: string
  description?: string
  tabs?: string[]
  sections?: UiSection[]
  table?: UiTable
  actions?: string[]
}

const payrollLoanSections: UiSection[] = [
  {
    title: "Add Loans",
    fields: [
      { label: "Month", type: "month", required: true },
      { label: "Parwest ID", required: true },
      { label: "Guard Name", required: true },
      { label: "Phone" },
      { label: "Client/Branch", type: "select" },
      { label: "Select Supervisor", type: "select" },
      { label: "Select Manager", type: "select" },
      { label: "Date of Loan Passing", type: "date", required: true },
      { label: "Deployment Days", type: "number" },
      { label: "Current Supervisor/Manager" },
      { label: "Amount Paid", type: "number", required: true },
      { label: "Remarks", type: "textarea" },
      { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
      { label: "Search:" },
      { label: "Select Date", type: "date" },
    ],
  },
]

export const payrollOperationScreens: Record<string, ScreenConfig> = {
  loan: {
    title: "Loan",
    description: "Loan operations with add/finalize/export tabs.",
    tabs: ["Add Loans", "Finalize Loans", "Export Finalised History"],
    sections: payrollLoanSections,
    actions: ["Save Loan", "Finalize Loans", "Export Finalised History"],
    table: {
      title: "Loan Records",
      columns: ["Month", "Parwest ID", "Guard", "Client/Branch", "Amount", "Status", "Action"],
    },
  },
  "extra-hours": {
    title: "Extra Hours",
    sections: [
      {
        title: "Extra Hours",
        fields: [
          { label: "Parwest ID", required: true },
          { label: "Select Client", type: "select" },
          { label: "Select Branch", type: "select", required: true },
          { label: "Hours", type: "number", required: true },
          { label: "Creation Date", type: "date", required: true },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
    ],
    actions: ["Submit", "Reset", "Export In Excel"],
    table: { columns: ["Parwest ID", "Client", "Branch", "Hours", "Creation Date", "Action"] },
  },
  "other-deductions": {
    title: "Other Deductions",
    sections: [
      {
        title: "Other Deductions",
        fields: [
          { label: "Parwest ID", required: true },
          { label: "Select Client", type: "select" },
          { label: "Select Branch", type: "select" },
          { label: "Month", type: "month", required: true },
          { label: "Amount", type: "number", required: true },
          { label: "Reason", type: "textarea", required: true },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
    ],
    actions: ["Submit", "Reset", "Export In Excel"],
    table: { columns: ["Parwest ID", "Client", "Branch", "Month", "Amount", "Reason", "Action"] },
  },
  "special-duty": {
    title: "Special Duty",
    sections: [
      {
        title: "Special Duty",
        fields: [
          { label: "Secure Ops ID", required: true },
          { label: "Select Client", type: "select" },
          { label: "Select Branch", type: "select" },
          { label: "From Date", type: "date", required: true },
          { label: "To Date", type: "date", required: true },
          { label: "Hours", type: "number", required: true },
          { label: "Cost Per Hour", type: "number", required: true },
          { label: "Comments", type: "textarea" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
    ],
    actions: ["Submit", "Reset", "Export In Excel"],
    table: { columns: ["Secure Ops ID", "Client", "Branch", "Date Range", "Hours", "Cost/Hour", "Comments", "Action"] },
  },
  holidays: {
    title: "Holidays",
    sections: [
      {
        title: "Holidays",
        fields: [
          { label: "Holiday Name", required: true },
          { label: "Date", type: "date", required: true },
          { label: "Notes", type: "textarea" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
    ],
    actions: ["Add", "Reset", "Submit", "Export In Excel"],
    table: { columns: ["Holiday", "Date", "Notes", "Action"] },
  },
  salary: {
    title: "Calculate Salary",
    tabs: ["Calculate Salary", "Salary History"],
    sections: [
      {
        title: "Calculate Salary Filters",
        fields: [
          { label: "Region", type: "select", required: true },
          { label: "Select Client", type: "select" },
          { label: "Branch", type: "select" },
          { label: "Month", type: "month", required: true },
        ],
      },
    ],
    actions: ["CALCULATE SALARY"],
    table: { columns: ["Parwest ID", "Guard", "Client/Branch", "Days", "Amount", "Status"] },
  },
  "salary-v2": {
    title: "Salary V2",
    sections: [{
      title: "Salary V2 Filters",
      fields: [
        { label: "Month", type: "month", required: true },
        { label: "Region", type: "select" },
        { label: "Select Client", type: "select" },
        { label: "Select Branch", type: "select" },
        { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
        { label: "Search:" },
        { label: "Select Date", type: "date" },
      ],
    }],
    actions: ["Search", "Reset", "Submit", "Export Summary", "Export In Excel File"],
    table: { columns: ["Parwest ID", "Guard", "Client", "Branch", "Base", "Deductions", "Net Salary", "Status"] },
  },
  "bulk-salary-slips": {
    title: "Bulk Salary Slips",
    sections: [{
      title: "Bulk Salary Slips",
      fields: [
        { label: "Month", type: "month", required: true },
        { label: "Region", type: "select" },
        { label: "Select Client", type: "select" },
        { label: "Select Branch", type: "select" },
        { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
        { label: "Search:" },
        { label: "Select Date", type: "date" },
      ],
    }],
    actions: ["Search", "Reset", "Submit", "Generate Slips", "Download Zip", "Export In Excel File"],
    table: { columns: ["Cycle", "Employees", "Generated At", "Generated By", "Action"] },
  },
  clearance: {
    title: "Clearance",
    sections: [{
      title: "Clearance",
      fields: [
        { label: "Parwest ID" },
        { label: "Select Client", type: "select" },
        { label: "Select Branch", type: "select" },
        { label: "Last Working Date", type: "date" },
        { label: "Pending Dues", type: "number" },
        { label: "Notes", type: "textarea" },
        { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
        { label: "Search:" },
        { label: "Select Date", type: "date" },
      ],
    }],
    actions: ["Search", "Reset", "Submit", "Process Clearance", "Export In Excel File"],
    table: { columns: ["Parwest ID", "Name", "Client", "Branch", "Final Amount", "Status", "Action"] },
  },
  "unpaid-salaries": {
    title: "UnPaid Salaries",
    sections: [{
      title: "UnPaid Salaries",
      fields: [
        { label: "Month", type: "month" },
        { label: "Region", type: "select" },
        { label: "Select Client", type: "select" },
        { label: "Select Branch", type: "select" },
        { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
        { label: "Search:" },
        { label: "Select Date", type: "date" },
      ],
    }],
    actions: ["Search", "Reset", "Submit", "Export Unpaid Report", "Export In Excel File"],
    table: { columns: ["Parwest ID", "Guard", "Client", "Branch", "Month", "Amount", "Reason", "Action"] },
  },
}

export const inventoryScreens: Record<string, ScreenConfig> = {
  search: {
    title: "Search",
    description: "Central management hub for inventory.",
    sections: [
      {
        title: "Filters",
        fields: [
          { label: "Category", type: "select" },
          { label: "Product Type", type: "select" },
          { label: "Status", type: "select" },
          { label: "Vendor", type: "select" },
          { label: "Unique Number" },
          { label: "Serial Number" },
          { label: "Purchase Date From", type: "date" },
          { label: "Purchase Date To", type: "date" },
          { label: "Price", type: "number" },
          { label: "License Details" },
          { label: "Size" },
          { label: "Insured", type: "checkbox" },
          { label: "Duplicate", type: "checkbox" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
    ],
    actions: ["Search", "Reset", "Submit", "Export In Excel File"],
    table: { columns: ["Category", "Item", "PPS #", "Secure Ops Number", "Vendor", "Status", "License Number", "Serial Number"] },
  },
  categories: {
    title: "Define Categories",
    sections: [{ title: "Category", fields: [{ label: "Category Name", placeholder: "WEAPON / UNIFORM / EQUIPMENT / AMMUNITION" }, { label: "Show", type: "select", options: ["10", "25", "50", "100"] }, { label: "Search:" }] }],
    actions: ["Create", "Reset", "Submit", "Update", "Delete"],
    table: { columns: ["Name", "Created At", "Action"] },
  },
  vendors: {
    title: "Define Vendors",
    sections: [{ title: "Vendor", fields: [{ label: "Vendor Name" }, { label: "Contact" }, { label: "Show", type: "select", options: ["10", "25", "50", "100"] }, { label: "Search:" }] }],
    actions: ["Create", "Reset", "Submit", "Update", "Delete"],
    table: { columns: ["Name", "Contact", "Action"] },
  },
  conditions: {
    title: "Define Conditions",
    sections: [{ title: "Condition", fields: [{ label: "Condition Name", placeholder: "NEW / OLD" }, { label: "Show", type: "select", options: ["10", "25", "50", "100"] }, { label: "Search:" }] }],
    actions: ["Create", "Reset", "Submit", "Update", "Delete"],
    table: { columns: ["Condition", "Action"] },
  },
  demand: {
    title: "Demand",
    sections: [{ title: "Demand Request", fields: [{ label: "Regional Office", type: "select" }, { label: "Category", type: "select" }, { label: "Item", type: "select" }, { label: "Requested Quantity", type: "number" }, { label: "Notes", type: "textarea" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Checkout", "Track Requests", "Export In Excel File"],
    table: { columns: ["Request ID", "Regional Office", "Category", "Item", "Requested", "Fulfilled", "Status"] },
  },
  "stock-in": {
    title: "Stock In",
    sections: [{ title: "Register New Inventory", fields: [{ label: "Order ID" }, { label: "Category", type: "select" }, { label: "Item", type: "select" }, { label: "Vendor", type: "select" }, { label: "Price", type: "number" }, { label: "Purchase Date", type: "date" }, { label: "Date of Expiry", type: "date" }, { label: "Warranty Time" }, { label: "Warranty Type" }, { label: "Size" }, { label: "Weight" }, { label: "Length" }, { label: "Width" }, { label: "Color" }, { label: "Is Insured", type: "checkbox" }, { label: "Is Non Unique", type: "checkbox" }, { label: "Quantity of Non Unique Items", type: "number" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Save Stock In", "Export In Excel File"],
  },
  "assign-item": {
    title: "Assign Item",
    sections: [{ title: "Assign Inventory", fields: [{ label: "Assign To", type: "select", options: ["Client", "Guard"] }, { label: "Select Regional Office", type: "select" }, { label: "Select Category", type: "select" }, { label: "Select Client/Guard", type: "select" }, { label: "Secure Ops Unique Number" }, { label: "Serial Number" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Checkout", "Clear", "Export In Excel File"],
    table: { columns: ["Item", "Assigned To", "Assigned At", "Returned At", "Status"] },
  },
  condemned: {
    title: "Condemned Items",
    sections: [{ title: "Condemn Item", fields: [{ label: "Unique ID" }, { label: "Condemned Date", type: "date" }, { label: "Reason", type: "textarea" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Mark as Condemned", "Export In Excel File"],
    table: { columns: ["Unique ID", "Product Type", "Category", "Vendor", "Regional Office", "Purchase Date", "Condemned Date"] },
  },
}

export const reportScreens: Record<string, ScreenConfig> = {
  scheduled: {
    title: "Scheduled Reports",
    sections: [{ title: "Schedule Configuration", fields: [{ label: "Report Type", type: "select" }, { label: "Frequency", type: "select" }, { label: "Region", type: "select" }, { label: "Recipient Email addresses", type: "textarea" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Save Schedule", "Export In Excel File"],
    table: { columns: ["Report Type", "Frequency", "Region", "Recipients", "Status", "Action"] },
  },
  "guard-deployment": {
    title: "Guard Deployment Report",
    sections: [{ title: "Filters", fields: [{ label: "Start Date", type: "date" }, { label: "End Date", type: "date" }, { label: "Regional Offices", type: "select" }, { label: "Client Types", type: "select" }, { label: "Specific Clients", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
  },
  "day-night-duty": {
    title: "Day and Night Duty Guards",
    sections: [{ title: "Filters", fields: [{ label: "Date From", type: "date" }, { label: "Date To", type: "date" }, { label: "Regional Office", type: "select" }, { label: "Client Type", type: "select" }, { label: "Client", type: "select" }, { label: "Report Type", type: "select", options: ["Day", "Night", "Both"] }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
  },
  "client-enrolled": {
    title: "Client Enrolled Report",
    sections: [{ title: "Filters", fields: [{ label: "Start Date", type: "date" }, { label: "End Date", type: "date" }, { label: "Regional Offices", type: "select" }, { label: "Branch Types", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
  },
  // Legacy route aliases (frontend parity)
  scheduledreports: {
    title: "Scheduled Reports",
    sections: [{ title: "Schedule Configuration", fields: [{ label: "Report Type", type: "select" }, { label: "Frequency", type: "select" }, { label: "Region", type: "select" }, { label: "Recipient Email addresses", type: "textarea" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Save Schedule", "Export In Excel File"],
    table: { columns: ["Report Type", "Frequency", "Region", "Recipients", "Status", "Action"] },
  },
  guardDeploymentreports: {
    title: "Guard Deployment Report",
    sections: [{ title: "Filters", fields: [{ label: "Start Date", type: "date" }, { label: "End Date", type: "date" }, { label: "Regional Offices", type: "select" }, { label: "Client Types", type: "select" }, { label: "Specific Clients", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
  },
  dayNightDutyGuards: {
    title: "Day and Night Duty Guards",
    sections: [{ title: "Filters", fields: [{ label: "Date From", type: "date" }, { label: "Date To", type: "date" }, { label: "Regional Office", type: "select" }, { label: "Client Type", type: "select" }, { label: "Client", type: "select" }, { label: "Report Type", type: "select", options: ["Day", "Night", "Both"] }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
  },
  clientEnrolledreports: {
    title: "Client Enrolled Report",
    sections: [{ title: "Filters", fields: [{ label: "Start Date", type: "date" }, { label: "End Date", type: "date" }, { label: "Regional Offices", type: "select" }, { label: "Branch Types", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
  },
  "client-summary": {
    title: "Client Summary",
    sections: [{ title: "Filters", fields: [{ label: "Region", type: "select" }, { label: "Client Type", type: "select" }, { label: "Client", type: "select" }, { label: "Month", type: "month" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
    table: { columns: ["Client", "Branches", "Day Guards", "Night Guards", "Status"] },
  },
  "client-branch-deactive-report": {
    title: "Client Branch Deactive Report",
    sections: [{ title: "Filters", fields: [{ label: "Region", type: "select" }, { label: "Client", type: "select" }, { label: "Date From", type: "date" }, { label: "Date To", type: "date" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
    table: { columns: ["Client", "Branch", "Deactivated On", "Reason"] },
  },
  dailyUserReport: {
    title: "Daily User Report",
    sections: [{ title: "Filters", fields: [{ label: "Date", type: "date" }, { label: "Region", type: "select" }, { label: "Role", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
    table: { columns: ["User", "Role", "Login Time", "Logout Time", "Duration"] },
  },
  dailydeploymentreport: {
    title: "Daily Deployment Report",
    sections: [{ title: "Filters", fields: [{ label: "Date", type: "date" }, { label: "Region", type: "select" }, { label: "Client", type: "select" }, { label: "Branch", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
    table: { columns: ["Date", "Client", "Branch", "Guard", "Shift"] },
  },
  "guardEnrolledreports": {
    title: "Guard Enrolled Report",
    sections: [{ title: "Filters", fields: [{ label: "Date From", type: "date" }, { label: "Date To", type: "date" }, { label: "Region", type: "select" }, { label: "Status", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
    table: { columns: ["Parwest ID", "Guard Name", "Region", "Joining Date", "Status"] },
  },
  guards: {
    title: "Guards Report",
    sections: [{ title: "Filters", fields: [{ label: "Region", type: "select" }, { label: "Client", type: "select" }, { label: "Status", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
    table: { columns: ["Parwest ID", "Guard", "Client", "Branch", "Status"] },
  },
  "managers-supervisors-guards": {
    title: "Managers Supervisors Guards",
    sections: [{ title: "Filters", fields: [{ label: "Region", type: "select" }, { label: "Manager", type: "select" }, { label: "Supervisor", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
    table: { columns: ["Manager", "Supervisor", "Total Guards", "Region"] },
  },
  shortdeployment: {
    title: "Short Deployment Report",
    sections: [{ title: "Filters", fields: [{ label: "Date From", type: "date" }, { label: "Date To", type: "date" }, { label: "Client", type: "select" }, { label: "Branch", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
    table: { columns: ["Guard", "Client", "Branch", "Days Deployed", "Status"] },
  },
  unassignguards: {
    title: "Unassigned Guards Report",
    sections: [{ title: "Filters", fields: [{ label: "Region", type: "select" }, { label: "Status", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
    table: { columns: ["Parwest ID", "Guard Name", "Region", "Current Status"] },
  },
  "finalized-paid-loan": {
    title: "Finalized Paid Loan Report",
    sections: [{ title: "Filters", fields: [{ label: "Month", type: "month" }, { label: "Region", type: "select" }, { label: "Supervisor", type: "select" }, { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] }, { label: "Search:" }, { label: "Select Date", type: "date" }] }],
    actions: ["Search", "Reset", "Submit", "Generate Report", "Export In Excel File"],
    table: { columns: ["Parwest ID", "Guard", "Amount", "Paid Date", "Supervisor"] },
  },
}

export const importScreens: Record<string, ScreenConfig> = {
  users: {
    title: "Users Import",
    sections: [{
      title: "Upload User File",
      fields: [
        { label: "Name" },
        { label: "Secure Ops Domain Email", type: "email" },
        { label: "User Role", type: "select" },
        { label: "Regional Office Series" },
        { label: "Contact Number" },
        { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
        { label: "Search:" },
        { label: "Select Date", type: "date" },
      ],
    }],
    actions: ["Choose File", "Reset", "Submit", "Validate", "Import", "Export In Excel File"],
    table: { columns: ["Row", "Name", "Email", "Role", "Result"] },
  },
  guards: {
    title: "Guards Import",
    tabs: ["Registration", "Verification", "Training", "Experience", "Family", "Placement", "References"],
    sections: [{
      title: "Upload Guard File",
      fields: [
        { label: "Import Type", type: "select" },
        { label: "Upload File" },
        { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
        { label: "Search:" },
        { label: "Select Date", type: "date" },
      ],
    }],
    actions: ["Choose File", "Reset", "Submit", "Validate", "Import", "Export In Excel File"],
    table: { columns: ["Row", "Guard", "Type", "Result"] },
  },
  clients: {
    title: "Clients Import",
    sections: [{
      title: "Bulk Client/Branch Upload",
      fields: [
        { label: "Upload File" },
        { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
        { label: "Search:" },
        { label: "Select Date", type: "date" },
      ],
    }],
    actions: ["Choose File", "Reset", "Submit", "Validate", "Import", "Export In Excel File"],
    table: { columns: ["Row", "Client", "Branch", "Result"] },
  },
  inventory: {
    title: "Inventory Import",
    sections: [{
      title: "Bulk Inventory Upload",
      fields: [
        { label: "Upload File" },
        { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
        { label: "Search:" },
        { label: "Select Date", type: "date" },
      ],
    }],
    actions: ["Choose File", "Reset", "Submit", "Validate", "Import", "Export In Excel File"],
    table: { columns: ["Row", "Item", "Category", "Result"] },
  },
}

export const payrollReportExports = [
  "Export Bank Salary",
  "Export Cash Salary",
  "Bank Transfer Sheet",
  "Mobile Account",
  "EOBI List",
  "EOBI Export",
  "ESSI List",
  "ESSI Export",
  "Salary Summary Report",
  "Region-wise Report",
  "Salary Detail Report",
  "Unpaid Salary Report",
]

export const payrollOperationLinks = [
  { label: "Loan", href: "/payroll/operations/loan" },
  { label: "Extra Hours", href: "/payroll/operations/extra-hours" },
  { label: "Other Deductions", href: "/payroll/operations/other-deductions" },
  { label: "Special Duty", href: "/payroll/operations/special-duty" },
  { label: "Holidays", href: "/payroll/operations/holidays" },
  { label: "Salary", href: "/payroll/operations/salary-v2" },
  { label: "Bulk Slips", href: "/payroll/operations/bulk-salary-slips" },
  { label: "Clearance", href: "/payroll/operations/clearance" },
  { label: "UnPaid", href: "/payroll/operations/unpaid-salaries" },
]

export const inventoryLinks = [
  { label: "Dashboard", href: "/inventory" },
  { label: "Search", href: "/inventory/search" },
  { label: "Categories", href: "/inventory/categories" },
  { label: "Vendors", href: "/inventory/vendors" },
  { label: "Conditions", href: "/inventory/conditions" },
  { label: "Demand", href: "/inventory/demand" },
  { label: "Stock In", href: "/inventory/stock-in" },
  { label: "Assign Item", href: "/inventory/assign-item" },
  { label: "Condemned", href: "/inventory/condemned" },
]

export const reportLinks = [
  { label: "Overview", href: "/reports" },
  { label: "Scheduled", href: "/reports/scheduled" },
  { label: "Guard Deployment", href: "/reports/guard-deployment" },
  { label: "Day & Night", href: "/reports/day-night-duty" },
  { label: "Client Enrolled", href: "/reports/client-enrolled" },
  { label: "AI/Prompt", href: "/reports/ai" },
  { label: "Generated List", href: "/reports/generated" },
]

export const importLinks = [
  { label: "Overview", href: "/imports" },
  { label: "Users Import", href: "/imports/users" },
  { label: "Guards Import", href: "/imports/guards" },
  { label: "Clients Import", href: "/imports/clients" },
  { label: "Inventory Import", href: "/imports/inventory" },
]

export const dashboardScreens: Record<string, ScreenConfig> = {
  "online-users": {
    title: "Online Users",
    description: "Current active users with filters and session activity snapshot.",
    sections: [
      {
        title: "Online User Filters",
        fields: [
          { label: "Regional Office", type: "select" },
          { label: "Role", type: "select" },
          { label: "User Name" },
          { label: "Last Activity From", type: "date" },
          { label: "Last Activity To", type: "date" },
        ],
      },
    ],
    actions: ["Search", "Clear", "Export In Excel"],
    table: { columns: ["User", "Role", "Regional Office", "IP Address", "Last Activity", "Session ID"] },
  },
}

export const userScreens: Record<string, ScreenConfig> = {
  new: {
    title: "User Enrolment Form",
    description: "User enrolment form from UI docs.",
    sections: [
      {
        title: "User Enrolment",
        fields: [
          { label: "User's Name", required: true },
          { label: "Email", type: "email", required: true },
          { label: "User Role", type: "select", required: true },
          { label: "Select Region", type: "select" },
          { label: "Regional Office", type: "select" },
          { label: "Contact #", required: true },
          { label: "Password", required: true },
          { label: "Status", type: "select", options: ["Active", "Inactive"] },
        ],
      },
    ],
    actions: ["Submit", "Reset"],
    table: { columns: ["Name", "Email", "Role", "Regional Office", "Status"] },
  },
  search: {
    title: "Search Users",
    sections: [
      {
        title: "Filters",
        fields: [
          { label: "Name" },
          { label: "Email" },
          { label: "User Role", type: "select" },
          { label: "Regional Office", type: "select" },
          { label: "Status", type: "select" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
    ],
    actions: ["Search", "Reset", "Submit", "Export In Excel File"],
    table: { columns: ["ID", "Photo", "Name", "Email", "Role", "Regional Office", "Status", "Action"] },
  },
  "ms-relationship": {
    title: "M/S Relationship",
    description: "Assign managers to supervisors.",
    sections: [
      {
        title: "Assign Relationship",
        fields: [
          { label: "Manager", type: "select", required: true },
          { label: "Supervisor", type: "select", required: true },
          { label: "Effective Date", type: "date" },
          { label: "Notes", type: "textarea" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100"] },
          { label: "Search:" },
        ],
      },
    ],
    actions: ["Assign", "Reset", "Submit", "Export In Excel File"],
    table: { columns: ["Manager", "Supervisor", "Effective Date", "Status", "Action"] },
  },
  "cs-relationship": {
    title: "C/S Relationship",
    description: "Assign client branches to supervisors.",
    sections: [
      {
        title: "Assign Client Branch",
        fields: [
          { label: "Client", type: "select", required: true },
          { label: "Branch", type: "select", required: true },
          { label: "Supervisor", type: "select", required: true },
          { label: "Effective Date", type: "date" },
          { label: "Notes", type: "textarea" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100"] },
          { label: "Search:" },
        ],
      },
    ],
    actions: ["Assign", "Reset", "Submit", "Export In Excel File"],
    table: { columns: ["Client", "Branch", "Supervisor", "Effective Date", "Status", "Action"] },
  },
  "switch-supervisor": {
    title: "Switch Supervisor",
    description: "Bulk transfer supervisors between managers or locations.",
    sections: [
      {
        title: "Switch Tool",
        fields: [
          { label: "Region", type: "select" },
          { label: "Regional Office", type: "select" },
          { label: "From Supervisor", type: "select", required: true },
          { label: "To Supervisor", type: "select", required: true },
          { label: "Reason", type: "textarea" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100"] },
          { label: "Search:" },
        ],
      },
    ],
    actions: ["Preview", "Switch", "Reset", "Submit", "Export In Excel File"],
    table: { columns: ["From Supervisor", "To Supervisor", "Region", "Regional Office", "Result"] },
  },
}

export const userLinks = [
  { label: "Add New", href: "/users/new" },
  { label: "Search", href: "/users/search" },
  { label: "Permissions", href: "/users/permissions" },
  { label: "M/S Relationship", href: "/users/ms-relationship" },
  { label: "Switch Supervisor", href: "/users/switch-supervisor" },
  { label: "C/S Relationship", href: "/users/cs-relationship" },
]

export const ticketScreens: Record<string, ScreenConfig> = {
  listing: {
    title: "Ticketing Listing",
    description: "All tickets listing with documented filters and columns.",
    sections: [
      {
        title: "Search Filters",
        fields: [
          { label: "Category", type: "select" },
          { label: "Priority", type: "select" },
          { label: "Status", type: "select" },
          { label: "Supervisor", type: "select" },
          { label: "Created Date", type: "date" },
          { label: "Ticket ID" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
    ],
    actions: ["Search", "Reset", "Submit", "Export In Excel File"],
    table: { columns: ["ID", "Subject", "Sender", "Category", "Priority", "Status", "Assigned To", "Created At", "Action"] },
  },
}

export const requisitionScreens: Record<string, ScreenConfig> = {
  approvals: {
    title: "Requisitions",
    description: "Guard Approval By HO with Pending / Accepted / Rejected tabs.",
    tabs: ["Pending", "Accepted", "Rejected"],
    sections: [
      {
        title: "Guard Approval Filters",
        fields: [
          { label: "Secure Ops ID" },
          { label: "Name" },
          { label: "Current Status", type: "select" },
          { label: "Over Age", type: "select", options: ["Yes", "No"] },
          { label: "From Date", type: "date" },
          { label: "To Date", type: "date" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
    ],
    actions: ["Search", "Reset", "Submit", "Approve", "Reject", "Export In Excel File"],
    table: { columns: ["Secure Ops ID", "Name", "Current Status", "Over Age", "Pic", "Requested At", "Action"] },
  },
}

export const auditScreens: Record<string, ScreenConfig> = {
  search: {
    title: "Audit Search",
    description: "System-wide activity tracking and compliance log.",
    sections: [
      {
        title: "Audit Filters",
        fields: [
          { label: "Date From", type: "date" },
          { label: "Date To", type: "date" },
          { label: "User Name" },
          { label: "Event", type: "select" },
          { label: "Module", type: "select" },
          { label: "IP Address" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
    ],
    actions: ["Search", "Reset", "Submit", "Export In Excel File"],
    table: { columns: ["Date", "User Name", "Event", "Module", "IP Address", "Description"] },
  },
}

export const payrollScreens: Record<string, ScreenConfig> = {
  operationsHub: {
    title: "Operation",
    description: "Frontend parity screen for payroll operational workflows from UI docs.",
    sections: [
      {
        title: "Operation Overview",
        fields: [
          { label: "Month", type: "month" },
          { label: "Region", type: "select" },
          { label: "Select Client", type: "select" },
          { label: "Branch", type: "select" },
        ],
      },
    ],
    actions: ["Search", "Clear", "Export In Excel"],
    table: { columns: ["Operation", "Month", "Region", "Client", "Branch", "Action"] },
  },
  reportsHub: {
    title: "Reports",
    description: "Export and analytics tools listed in payroll report submenu.",
    sections: [
      {
        title: "Report Filters",
        fields: [
          { label: "Month", type: "month" },
          { label: "Region", type: "select" },
          { label: "Select Client", type: "select" },
          { label: "Select Branch", type: "select" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
      {
        title: "Export Set",
        fields: payrollReportExports.map((name) => ({ label: name, type: "checkbox" })),
      },
    ],
    actions: ["Search", "Reset", "Submit", "Run Selected Report", "Export", "Export In Excel File"],
    table: { columns: ["Report", "Frequency", "Last Run", "Status", "Action"] },
  },
  settingsHub: {
    title: "Settings",
    description: "Payroll defaults, month initialize, and limits from UI docs.",
    tabs: ["Payroll Defaults", "Month Initialise", "Limits"],
    sections: [
      {
        title: "Payroll Defaults",
        fields: [
          { label: "Training School Fees", type: "number" },
          { label: "CWF", type: "number" },
          { label: "Age Threshold", type: "number" },
          { label: "Deployment Threshold", type: "number" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
        ],
      },
      {
        title: "Month Initialise",
        fields: [
          { label: "Current Month", type: "month" },
          { label: "Next Month", type: "month" },
          { label: "Unposted Regions", type: "select" },
          { label: "Select Date", type: "date" },
        ],
      },
      {
        title: "Limits",
        fields: [
          { label: "Guard Age Limit", type: "number" },
          { label: "Mental Health Limit", type: "number" },
        ],
      },
    ],
    actions: ["Reset", "Submit", "Save Defaults", "Initialize Month", "Save Limits"],
    table: { columns: ["Setting Group", "Key", "Value", "Updated At"] },
  },
}

export const moduleHubScreens: Record<string, ScreenConfig> = {
  inventoryDashboard: {
    title: "Inventory Dashboard",
    description: "Asset dashboard with availability, issued, and remaining counts.",
    sections: [
      {
        title: "Dashboard Cards",
        fields: [
          { label: "Total Available", type: "number" },
          { label: "Issued", type: "number" },
          { label: "Remaining", type: "number" },
        ],
      },
    ],
    actions: ["Search", "Clear"],
    table: { columns: ["Product Type", "Total Available", "Issued", "Remaining"] },
  },
  reportsHub: {
    title: "Reports",
    description: "Frontend route hub for all documented report screens.",
    sections: [
      {
        title: "Report Hub",
        fields: [
          { label: "Date From", type: "date" },
          { label: "Date To", type: "date" },
          { label: "Region", type: "select" },
        ],
      },
    ],
    actions: ["Generate", "Export", "Clear"],
    table: { columns: ["Report", "Date Range", "Region", "Generated At", "Status"] },
  },
  importsHub: {
    title: "Imports",
    description: "Bulk operations hub for users, guards, clients, and inventory.",
    sections: [{ title: "Import Workflow", fields: [{ label: "Import Type", type: "select" }, { label: "Upload File" }] }],
    actions: ["Validate", "Import", "Clear"],
    table: { columns: ["Import Type", "Uploaded By", "Uploaded At", "Status", "Action"] },
  },
  ticketNew: {
    title: "Create Ticket",
    description: "Frontend-only ticket creation flow.",
    sections: [
      {
        title: "Ticket Form",
        fields: [
          { label: "Subject", required: true },
          { label: "Description", type: "textarea", required: true },
          { label: "Category", type: "select", required: true },
          { label: "Priority", type: "select", required: true },
          { label: "Assign To", type: "select" },
        ],
      },
    ],
    actions: ["Submit", "Reset"],
    table: { columns: ["Subject", "Category", "Priority", "Assign To", "Status"] },
  },
  clientPricing: {
    title: "Client Pricing",
    description: "Contractual pricing and billing configurations.",
    sections: [
      {
        title: "Pricing Configuration",
        fields: [
          { label: "Client", type: "select", required: true },
          { label: "Guard Type", type: "select", required: true },
          { label: "Rate", type: "number", required: true },
          { label: "Effective From", type: "date" },
        ],
      },
    ],
    actions: ["Save", "Update", "Clear"],
    table: { columns: ["Client", "Guard Type", "Rate", "Effective From", "Action"] },
  },
  systemSettings: {
    title: "System Settings",
    description: "Frontend placeholder for global system settings.",
    sections: [
      {
        title: "General",
        fields: [
          { label: "Application Name" },
          { label: "Timezone", type: "select" },
          { label: "Default Currency", type: "select" },
          { label: "Show", type: "select", options: ["10", "25", "50", "100", "200"] },
          { label: "Search:" },
          { label: "Select Date", type: "date" },
        ],
      },
    ],
    actions: ["Reset", "Submit", "Save Settings", "Export In Excel File"],
    table: { columns: ["Setting", "Value", "Updated At"] },
  },
}
