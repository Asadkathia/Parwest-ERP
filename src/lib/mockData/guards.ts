// Mock data for Guards module

export const mockGuardProfile = {
    id: "cmlgf217m00009qo29of6v7u7",
    parwestId: "PW-00001",
    name: "Test Guard One",
    cnic: "42101-1234567-2",
    phone: "+92-300-1234567",
    email: "guard1@parwest.com",
    dateOfBirth: new Date("1990-01-15"),
    age: 34,
    fatherName: "Father Name",
    motherName: "Mother Name",
    religion: "Islam",
    maritalStatus: "Married",
    education: "Matric",
    nationality: "Pakistani",
    addressPermanent: "123 Main Street, Lahore, Punjab",
    addressCurrent: "456 Current Street, Lahore, Punjab",
    emergencyContact: "+92-300-7654321",
    nextOfKin: "Brother Name",
    status: "ACTIVE",
    regionalOffice: "Lahore Office",
    isExService: false,
    joiningDate: new Date("2020-01-15"),

    // Tab: Attachments
    attachments: [
        { id: "1", name: "CNIC Front", type: "CNIC", uploadedAt: "2024-01-15", url: "/mock/cnic-front.pdf", size: "245 KB" },
        { id: "2", name: "CNIC Back", type: "CNIC", uploadedAt: "2024-01-15", url: "/mock/cnic-back.pdf", size: "238 KB" },
        { id: "3", name: "Health Certificate", type: "HEALTH", uploadedAt: "2024-01-20", url: "/mock/health.pdf", size: "512 KB" },
        { id: "4", name: "Police Verification", type: "POLICE", uploadedAt: "2024-01-25", url: "/mock/police.pdf", size: "328 KB" },
    ],

    // Tab: Attendance
    attendance: [
        { date: "2024-02-01", status: "PRESENT", shift: "DAY", hours: 8 },
        { date: "2024-02-02", status: "PRESENT", shift: "DAY", hours: 8 },
        { date: "2024-02-03", status: "ABSENT", shift: "DAY", hours: 0, reason: "Sick Leave" },
        { date: "2024-02-04", status: "PRESENT", shift: "DAY", hours: 8 },
        { date: "2024-02-05", status: "PRESENT", shift: "DAY", hours: 10, overtime: 2 },
    ],
    attendanceSummary: {
        totalDays: 28,
        present: 26,
        absent: 2,
        leaves: 0,
        overtime: 4,
    },

    // Tab: Inventory
    inventory: [
        { id: "1", item: "Uniform Set", category: "UNIFORM", issuedDate: "2020-01-20", condition: "GOOD", serialNumber: "UNI-001" },
        { id: "2", item: "Baton", category: "EQUIPMENT", issuedDate: "2020-01-20", condition: "GOOD", serialNumber: "BAT-045" },
        { id: "3", item: "Whistle", category: "EQUIPMENT", issuedDate: "2020-01-20", condition: "GOOD", serialNumber: "WHS-123" },
    ],

    // Tab: Paid Salaries
    salaries: [
        { month: "2024-01", amount: 35000, status: "PAID", paidOn: "2024-02-05", method: "BANK", deductions: 2000, netAmount: 33000 },
        { month: "2023-12", amount: 35000, status: "PAID", paidOn: "2024-01-05", method: "BANK", deductions: 2000, netAmount: 33000 },
        { month: "2023-11", amount: 35000, status: "PAID", paidOn: "2023-12-05", method: "BANK", deductions: 2000, netAmount: 33000 },
    ],

    // Tab: Deployment History
    deployments: [
        {
            id: "1",
            client: "Punjab Test Client",
            branch: "Lahore Branch",
            designation: "Security Guard",
            startDate: "2024-02-10",
            endDate: null,
            status: "ACTIVE",
            shiftType: "DAY",
        },
        {
            id: "2",
            client: "Previous Client",
            branch: "Previous Branch",
            designation: "Security Guard",
            startDate: "2022-01-15",
            endDate: "2024-02-09",
            status: "INACTIVE",
            shiftType: "NIGHT",
        },
    ],

    // Tab: Courses
    courses: [
        { id: "1", name: "Basic Security Training", provider: "Parwest Training Center", completedDate: "2020-01-10", certificateUrl: "/mock/cert1.pdf" },
        { id: "2", name: "First Aid", provider: "Red Crescent", completedDate: "2020-06-15", certificateUrl: "/mock/cert2.pdf" },
        { id: "3", name: "Fire Safety", provider: "Parwest Training Center", completedDate: "2021-03-20", certificateUrl: "/mock/cert3.pdf" },
    ],

    // Tab: Verification
    verifications: [
        { type: "NADRA", status: "VERIFIED", verifiedBy: "Admin User", verifiedDate: "2020-01-05", expiryDate: null },
        { type: "HEALTH", status: "VERIFIED", verifiedBy: "Admin User", verifiedDate: "2020-01-08", expiryDate: "2025-01-08" },
        { type: "POLICE", status: "VERIFIED", verifiedBy: "Admin User", verifiedDate: "2020-01-10", expiryDate: null },
        { type: "EYESIGHT", status: "VERIFIED", verifiedBy: "Admin User", verifiedDate: "2020-01-08", expiryDate: "2025-01-08" },
        { type: "CHARACTER", status: "VERIFIED", verifiedBy: "Admin User", verifiedDate: "2020-01-12", expiryDate: null },
        { type: "MENTAL_HEALTH", status: "VERIFIED", verifiedBy: "Admin User", verifiedDate: "2020-01-08", expiryDate: "2025-01-08" },
    ],

    // Tab: Pledged Documents
    pledgedDocuments: [
        { id: "1", type: "Matric Certificate", receivedDate: "2020-01-15", returnStatus: "HELD", notes: "Original certificate" },
        { id: "2", type: "CNIC Original", receivedDate: "2020-01-15", returnStatus: "HELD", notes: "To be returned on resignation" },
    ],

    // Tab: Bank Details
    bankDetails: {
        bankName: "HBL",
        accountNumber: "1234567890123",
        accountType: "SAVINGS",
        branchCode: "0123",
        iban: "PK12HABB1234567890123456",
        cardStatus: "ACTIVE",
    },

    // Tab: Residence History
    residenceHistory: [
        {
            id: "1",
            address: "Parwest Residence A, Lahore",
            supervisor: "Supervisor Name",
            assignDate: "2020-02-01",
            vacateDate: null,
            status: "CURRENT",
        },
        {
            id: "2",
            address: "Previous Residence, Lahore",
            supervisor: "Previous Supervisor",
            assignDate: "2020-01-20",
            vacateDate: "2020-01-31",
            status: "VACATED",
        },
    ],

    // Tab: OnJob Trainings
    ojtTrainings: [
        {
            id: "1",
            date: "2024-01-15",
            location: "Punjab Test Client - Lahore Branch",
            conductedBy: "Training Officer A",
            topics: "Security protocols, Emergency procedures",
            supervisor: "Branch Supervisor",
        },
        {
            id: "2",
            date: "2023-07-20",
            location: "Punjab Test Client - Lahore Branch",
            conductedBy: "Training Officer B",
            topics: "Customer service, Conflict resolution",
            supervisor: "Branch Supervisor",
        },
    ],

    // Tab: Store Inventory
    storeInventory: [
        { id: "1", item: "Flashlight", quantity: 1, issueDate: "2020-01-20", returnDate: null, status: "ISSUED" },
        { id: "2", item: "Rain Coat", quantity: 1, issueDate: "2020-06-01", returnDate: null, status: "ISSUED" },
    ],

    // Tab: Service History
    serviceHistory: [
        {
            id: "1",
            event: "Promoted to Senior Guard",
            date: "2022-01-15",
            description: "Promoted based on excellent performance",
            changedBy: "Manager User",
        },
        {
            id: "2",
            event: "Transferred to Lahore Branch",
            date: "2024-02-10",
            description: "Transfer requested by client",
            changedBy: "Admin User",
        },
    ],

    // Tab: Insurance
    insurance: [
        {
            id: "1",
            policyNumber: "INS-2020-001",
            provider: "State Life Insurance",
            coverageAmount: 500000,
            startDate: "2020-01-15",
            expiryDate: "2025-01-15",
            beneficiary: "Brother Name",
            status: "ACTIVE",
        },
    ],

    // Tab: Status History
    statusHistory: [
        {
            id: "1",
            previousStatus: "PENDING",
            newStatus: "ACTIVE",
            changedBy: "Admin User",
            changedDate: "2020-01-15",
            reason: "All verifications completed",
        },
    ],

    // Tab: PBA Documents
    pbaDocuments: [
        { id: "1", name: "PBA Form A", type: "PBA_FORM", uploadedAt: "2020-01-15", verificationStatus: "VERIFIED", url: "/mock/pba-a.pdf" },
        { id: "2", name: "PBA Form B", type: "PBA_FORM", uploadedAt: "2020-01-15", verificationStatus: "VERIFIED", url: "/mock/pba-b.pdf" },
    ],
}

export const mockGuardsList = [
    mockGuardProfile,
    {
        ...mockGuardProfile,
        id: "guard-2",
        parwestId: "PW-00002",
        name: "Test Guard Two",
        cnic: "42101-7654321-1",
        status: "INACTIVE",
    },
]

export const mockBlacklistedGuards = [
    {
        id: "1",
        cnic: "42101-9999999-9",
        name: "Blacklisted Guard",
        blacklistedBy: "Admin User",
        blacklistedOn: "2024-01-15",
        reason: "Misconduct at client site",
    },
]

export const mockInactiveGuards = [
    {
        id: "1",
        name: "Inactive Guard One",
        parwestId: "PW-99999",
        deactivationDate: "2023-12-31",
        reason: "Resigned",
    },
]

export const mockResidences = [
    {
        id: "1",
        address: "Parwest Residence A, 123 Main St, Lahore",
        ownerName: "Parwest Group",
        ownerPhone: "+92-300-1111111",
        supervisor: "Supervisor A",
        capacity: 20,
        occupied: 15,
    },
    {
        id: "2",
        address: "Parwest Residence B, 456 Second St, Lahore",
        ownerName: "Parwest Group",
        ownerPhone: "+92-300-2222222",
        supervisor: "Supervisor B",
        capacity: 15,
        occupied: 12,
    },
]

export const mockTrainings = [
    {
        id: "1",
        date: "2024-02-01",
        dateOfOJT: "2024-02-01",
        regionalOffice: "Lahore Office",
        client: "Punjab Test Client",
        branch: "Lahore Branch",
        guards: "10 guards",
        branchSupervisor: "Supervisor Name",
        supervisorUniform: true,
        branchManager: "Manager Name",
        armorer: "Armorer Name",
        conductedBy: "Training Officer",
        dueDate: "2024-02-01",
        remarks: "All guards attended",
    },
]
