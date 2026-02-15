export type MockDeployment = {
  id: string
  guardId: string
  clientId: string
  branchId: string
  deploymentDate: string
  status: "ACTIVE" | "PENDING" | "INACTIVE"
  designation: string
}

export const mockDeploymentsList: MockDeployment[] = [
  {
    id: "mock-deploy-1",
    guardId: "PW-00001",
    clientId: "National Bank of Pakistan",
    branchId: "NBP Head Office",
    deploymentDate: "2026-01-10T00:00:00.000Z",
    status: "ACTIVE",
    designation: "Security Guard",
  },
  {
    id: "mock-deploy-2",
    guardId: "PW-00002",
    clientId: "Meezan Bank Limited",
    branchId: "MBL Gulberg",
    deploymentDate: "2026-01-20T00:00:00.000Z",
    status: "PENDING",
    designation: "Security Guard",
  },
  {
    id: "mock-deploy-3",
    guardId: "PW-00003",
    clientId: "Haier & Ruba Company",
    branchId: "HR Main Campus",
    deploymentDate: "2025-12-05T00:00:00.000Z",
    status: "INACTIVE",
    designation: "Supervisor",
  },
]
