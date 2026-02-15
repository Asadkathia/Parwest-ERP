export type MockClient = {
  id: string
  name: string
  type: string
  city: string | null
  status: string
  regionId: string | null
  branchCount: number
}

export const mockClientsList: MockClient[] = [
  {
    id: "mock-client-1",
    name: "National Bank of Pakistan",
    type: "BANK",
    city: "Lahore",
    status: "ACTIVE",
    regionId: "lahore",
    branchCount: 12,
  },
  {
    id: "mock-client-2",
    name: "Meezan Bank Limited",
    type: "BANK",
    city: "Karachi",
    status: "ACTIVE",
    regionId: "karachi",
    branchCount: 8,
  },
  {
    id: "mock-client-3",
    name: "Haier & Ruba Company",
    type: "OTHER",
    city: "Lahore",
    status: "INACTIVE",
    regionId: "lahore",
    branchCount: 2,
  },
]
