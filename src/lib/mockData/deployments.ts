// Mock deployment rows for NEXT_PUBLIC_USE_MOCKS mode.
//
// Shape kept at parity with the real GET /api/deployments projection
// (`src/app/api/deployments/route.ts` findMany include) and the fields the
// deployments list consumes (`DeploymentsListClient.tsx` DeploymentRow):
//   - top-level: guardId / regionalOfficeId / status / shiftType /
//     deploymentType / designation / deploymentDate / endDate
//   - nested: guard / client / branch / regionalOffice objects
// The GET mock branch filters on `row.guardId` + `row.status` and scopes on
// `row.regionalOfficeId`, so those flat keys are required.
//
// COMPAT: flat `clientId`/`branchId` intentionally hold the human-readable
// NAMES, because other mock consumers match on them by name
// (`prismaMock.ts` does `clients.find(c => c.name === d.clientId)` /
// `branches.find(b => b.name === d.branchId)`; `aiReports.ts`/`invoices.ts`
// surface them as display strings). The nested `client`/`branch` objects carry
// the real synthetic ids + names the list client reads.

export type MockDeployment = {
  id: string
  guardId: string
  /** Human-readable client name (compat key for prismaMock/aiReports/invoices). */
  clientId: string
  /** Human-readable branch name (compat key for prismaMock/aiReports/invoices). */
  branchId: string | null
  regionalOfficeId: string
  deploymentDate: string
  endDate: string | null
  status: "ACTIVE" | "PENDING" | "INACTIVE"
  shiftType: "DAY" | "NIGHT" | "BOTH"
  designation: string
  deploymentType: "REGULAR" | "OVERTIME" | "EXTRA"
  guard: {
    id: string
    parwestId: string
    name: string
    phone: string | null
    photoUrl: string | null
  }
  client: { id: string; name: string }
  branch: { id: string; name: string; city: string | null } | null
  regionalOffice: { id: string; name: string }
}

export const mockDeploymentsList: MockDeployment[] = [
  {
    id: "mock-deploy-1",
    guardId: "PW-00001",
    clientId: "National Bank of Pakistan",
    branchId: "NBP Head Office",
    regionalOfficeId: "office-lhr-1",
    deploymentDate: "2026-01-10T00:00:00.000Z",
    endDate: null,
    status: "ACTIVE",
    shiftType: "DAY",
    designation: "Security Guard",
    deploymentType: "REGULAR",
    guard: {
      id: "PW-00001",
      parwestId: "PW-00001",
      name: "Ahmed Khan",
      phone: "0300-1234567",
      photoUrl: null,
    },
    client: { id: "client-nbp", name: "National Bank of Pakistan" },
    branch: { id: "branch-nbp-ho", name: "NBP Head Office", city: "Lahore" },
    regionalOffice: { id: "office-lhr-1", name: "Lahore Office 1" },
  },
  {
    id: "mock-deploy-2",
    guardId: "PW-00002",
    clientId: "Meezan Bank Limited",
    branchId: "MBL Gulberg",
    regionalOfficeId: "office-lhr-1",
    deploymentDate: "2026-01-20T00:00:00.000Z",
    endDate: null,
    status: "PENDING",
    shiftType: "NIGHT",
    designation: "Security Guard",
    deploymentType: "REGULAR",
    guard: {
      id: "PW-00002",
      parwestId: "PW-00002",
      name: "Bilal Ahmed",
      phone: "0301-2345678",
      photoUrl: null,
    },
    client: { id: "client-mbl", name: "Meezan Bank Limited" },
    branch: { id: "branch-mbl-gulberg", name: "MBL Gulberg", city: "Lahore" },
    regionalOffice: { id: "office-lhr-1", name: "Lahore Office 1" },
  },
  {
    id: "mock-deploy-3",
    guardId: "PW-00003",
    clientId: "Haier & Ruba Company",
    branchId: "HR Main Campus",
    regionalOfficeId: "office-khi-1",
    deploymentDate: "2025-12-05T00:00:00.000Z",
    endDate: "2026-01-31T00:00:00.000Z",
    status: "INACTIVE",
    shiftType: "DAY",
    designation: "Supervisor",
    deploymentType: "REGULAR",
    guard: {
      id: "PW-00003",
      parwestId: "PW-00003",
      name: "Cawas Daruwala",
      phone: "0302-3456789",
      photoUrl: null,
    },
    client: { id: "client-haier", name: "Haier & Ruba Company" },
    branch: { id: "branch-hr-main", name: "HR Main Campus", city: "Karachi" },
    regionalOffice: { id: "office-khi-1", name: "Karachi Office 1" },
  },
]
