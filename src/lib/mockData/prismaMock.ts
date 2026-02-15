import { mockGuardProfile, mockGuardsList, mockInactiveGuards, mockResidences, mockTrainings } from "@/lib/mockData/guards"
import { mockClientsList } from "@/lib/mockData/clients"
import { mockDeploymentsList } from "@/lib/mockData/deployments"

type AnyRecord = Record<string, any>

const now = () => new Date()
const cuid = () => `mock_${Math.random().toString(36).slice(2, 10)}`

const regions = [
  { id: "lahore", name: "Lahore", createdAt: now(), updatedAt: now() },
  { id: "karachi", name: "Karachi", createdAt: now(), updatedAt: now() },
]

const regionalOffices = [
  { id: "office-lhr", name: "Lahore Head Office", seriesCode: "L", regionId: "lahore", createdAt: now(), updatedAt: now(), region: regions[0] },
  { id: "office-khi", name: "Karachi Regional Office", seriesCode: "K", regionId: "karachi", createdAt: now(), updatedAt: now(), region: regions[1] },
]

const roles = [
  { id: "role-super", name: "Super User", description: "Full system access", createdAt: now(), updatedAt: now() },
  { id: "role-admin", name: "Admin", description: "Admin access", createdAt: now(), updatedAt: now() },
]

const users = [
  {
    id: "user-admin",
    name: "Admin",
    email: "admin@parwestgroup.com",
    password: "$2a$10$mockmockmockmockmockmockmockmockmockmockmockmock",
    status: "ACTIVE",
    roleId: "role-admin",
    regionId: "lahore",
    regionalOfficeId: "office-lhr",
    createdAt: now(),
    updatedAt: now(),
  },
]

const clients = mockClientsList.map((c) => ({
  id: c.id,
  name: c.name,
  email: null,
  type: c.type,
  city: c.city,
  status: c.status,
  regionId: c.regionId,
  isBranchless: false,
  logoUrl: null,
  ntn: null,
  strn: null,
  contractUrl: null,
  headOfficeAddress: null,
  createdAt: now(),
  updatedAt: now(),
}))

const branches = [
  {
    id: "branch-1",
    clientId: "mock-client-1",
    name: "NBP Head Office",
    code: "NBP-HO",
    city: "Lahore",
    province: "Punjab",
    address: "Mall Road Lahore",
    isHeadOffice: true,
    contactPerson: "Muhammad Usman",
    contactPhone: "03001234567",
    contactEmail: "nbp-ho@example.com",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "branch-2",
    clientId: "mock-client-2",
    name: "MBL Gulberg",
    code: "MBL-GLB",
    city: "Karachi",
    province: "Sindh",
    address: "Gulberg Block 4",
    isHeadOffice: false,
    contactPerson: "Ali Raza",
    contactPhone: "03009876543",
    contactEmail: "mbl-glb@example.com",
    createdAt: now(),
    updatedAt: now(),
  },
]

const guards = mockGuardsList.map((g: any, idx) => ({
  id: g.id,
  parwestId: g.parwestId,
  name: g.name,
  cnic: g.cnic,
  phone: g.phone || null,
  email: g.email || null,
  dateOfBirth: g.dateOfBirth ? new Date(g.dateOfBirth) : null,
  age: g.age ?? null,
  fatherName: g.fatherName || null,
  religion: g.religion || null,
  maritalStatus: g.maritalStatus || null,
  education: g.education || null,
  addressPermanent: g.addressPermanent || null,
  addressCurrent: g.addressCurrent || null,
  emergencyContact: g.emergencyContact || null,
  status: g.status,
  isExService: !!g.isExService,
  exServiceRank: null,
  exServiceRegiment: null,
  bankName: g.bankName || g.bankDetails?.bankName || null,
  bankAccountNumber: g.bankAccountNumber || g.bankDetails?.accountNumber || null,
  bankAccountType: g.bankAccountType || g.bankDetails?.accountType || "SAVING",
  joiningDate: g.joiningDate ? new Date(g.joiningDate) : null,
  regionalOfficeId: "office-lhr",
  regionId: idx % 2 === 0 ? "lahore" : "karachi",
  createdAt: now(),
  updatedAt: now(),
}))

const deployments = mockDeploymentsList.map((d) => ({
  id: d.id,
  guardId: guards.find((g) => g.parwestId === d.guardId)?.id || guards[0]?.id,
  clientId: clients.find((c) => c.name === d.clientId)?.id || clients[0]?.id,
  branchId: branches.find((b) => b.name === d.branchId)?.id || branches[0]?.id,
  regionalOfficeId: "office-lhr",
  deploymentDate: new Date(d.deploymentDate),
  designation: d.designation,
  shiftType: "DAY",
  rate: null,
  status: d.status,
  notes: null,
  guardType: null,
  salary: null,
  overtime: null,
  extraHours: null,
  postAllowance: null,
  dayShiftStart: null,
  dayShiftEnd: null,
  nightShiftStart: null,
  nightShiftEnd: null,
  deploymentType: "REGULAR",
  isExtraGuard: false,
  comment: null,
  endDate: null,
  endReason: null,
  createdAt: now(),
  updatedAt: now(),
}))

const attendances = guards.flatMap((g, idx) => {
  const base = mockGuardProfile.attendance || []
  if (!base.length) return []
  return base.slice(0, 5).map((a: any, i: number) => ({
    id: `att-${g.id}-${i}`,
    guardId: g.id,
    date: new Date(a.date || now()),
    status: a.status || "PRESENT",
    shiftType: a.shift || "DAY",
    notes: a.reason || null,
    createdAt: now(),
    updatedAt: now(),
  }))
})

const residences = mockResidences.map((r) => ({
  id: r.id,
  address: r.address,
  ownerName: r.ownerName || null,
  ownerPhone: r.ownerPhone || null,
  supervisor: r.supervisor || null,
  capacity: r.capacity,
  occupied: r.occupied,
  createdAt: now(),
  updatedAt: now(),
}))

const trainings = mockTrainings.map((t: any) => ({
  id: t.id,
  regionalOffice: t.regionalOffice,
  client: t.client,
  branch: t.branch,
  supervisor: t.supervisor || t.branchSupervisor || null,
  manager: t.manager || t.branchManager || null,
  guardName: t.guardName || t.guards || null,
  guardId: t.guardId || null,
  trainedBy: t.trainedBy || t.conductedBy || null,
  date: new Date(t.date || t.dateOfOJT),
  armored: t.armored ?? (t.armorer ? true : false),
  remarks: t.remarks,
  createdAt: now(),
  updatedAt: now(),
}))

const ticketCategories = [
  { id: "tc-general", name: "General", description: "General issues", color: "#3B82F6", createdAt: now(), updatedAt: now() },
]
const ticketPriorities = [
  { id: "tp-normal", name: "Normal", color: "#3B82F6", createdAt: now(), updatedAt: now() },
]
const ticketStatuses = [
  { id: "ts-new", name: "New", color: "#3B82F6", createdAt: now(), updatedAt: now() },
]
const inventoryCategories = [
  { id: "ic-weapon", name: "WEAPON", createdAt: now(), updatedAt: now() },
]

const stores: Record<string, AnyRecord[]> = {
  user: users,
  role: roles,
  region: regions,
  regionalOffice: regionalOffices,
  guard: guards,
  client: clients,
  branch: branches,
  deployment: deployments,
  residence: residences,
  training: trainings,
  ticketCategory: ticketCategories,
  ticketPriority: ticketPriorities,
  ticketStatus: ticketStatuses,
  inventoryCategory: inventoryCategories,
  attendance: attendances,
  residenceAssignment: [],
  deploymentRate: [],
  loan: [],
  payroll: [],
  auditLog: [],
}

function matchWhere(row: AnyRecord, where: AnyRecord | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR" && Array.isArray(value)) {
      return value.some((cond) => matchWhere(row, cond))
    }
    if (key === "AND" && Array.isArray(value)) {
      return value.every((cond) => matchWhere(row, cond))
    }
    if (value && typeof value === "object" && "contains" in value) {
      return String(row[key] ?? "").toLowerCase().includes(String((value as AnyRecord).contains).toLowerCase())
    }
    if (value && typeof value === "object" && ("gte" in value || "lte" in value)) {
      const rv = row[key] instanceof Date ? row[key].getTime() : new Date(row[key]).getTime()
      const gte = (value as AnyRecord).gte ? new Date((value as AnyRecord).gte).getTime() : null
      const lte = (value as AnyRecord).lte ? new Date((value as AnyRecord).lte).getTime() : null
      if (gte != null && rv < gte) return false
      if (lte != null && rv > lte) return false
      return true
    }
    return row[key] === value
  })
}

function applyOrderBy<T extends AnyRecord>(rows: T[], orderBy: AnyRecord | undefined): T[] {
  if (!orderBy) return rows
  const [key, dir] = Object.entries(orderBy)[0] ?? []
  if (!key) return rows
  return [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av === bv) return 0
    const out = av > bv ? 1 : -1
    return dir === "desc" ? -out : out
  })
}

function includeRelations(model: string, row: AnyRecord, include: AnyRecord | undefined) {
  if (!include) return row
  const next = { ...row }

  if (model === "guard") {
    if (include.region) next.region = regions.find((r) => r.id === row.regionId) || null
    if (include.regionalOffice) next.regionalOffice = regionalOffices.find((o) => o.id === row.regionalOfficeId) || null
    if (include.attendances) {
      let rows = attendances.filter((a) => a.guardId === row.id)
      rows = rows.filter((a) => matchWhere(a, include.attendances.where))
      rows = applyOrderBy(rows, include.attendances.orderBy)
      if (typeof include.attendances.take === "number") rows = rows.slice(0, include.attendances.take)
      next.attendances = rows
    }
  }

  if (model === "client") {
    if (include.region) next.region = regions.find((r) => r.id === row.regionId) || null
    if (include.branches) {
      const branchInclude = typeof include.branches === "object" ? include.branches.include : undefined
      const branchOrderBy = typeof include.branches === "object" ? include.branches.orderBy : undefined
      let clientBranches = branches.filter((b) => b.clientId === row.id)
      clientBranches = applyOrderBy(clientBranches, branchOrderBy)
      next.branches = clientBranches.map((b) => includeRelations("branch", b, branchInclude))
    }
    if (include._count) next._count = { branches: branches.filter((b) => b.clientId === row.id).length }
  }

  if (model === "branch") {
    if (include.client) next.client = clients.find((c) => c.id === row.clientId) || null
    if (include.deployments) {
      const whereStatus = include.deployments?.where?.status
      const branchDeployments = deployments.filter((d) => d.branchId === row.id)
      const deploymentRows = whereStatus ? branchDeployments.filter((d) => d.status === whereStatus) : branchDeployments
      const deploymentInclude = typeof include.deployments === "object" ? include.deployments.include : undefined
      const deploymentOrderBy = typeof include.deployments === "object" ? include.deployments.orderBy : undefined
      next.deployments = applyOrderBy(deploymentRows, deploymentOrderBy).map((d) =>
        includeRelations("deployment", d, deploymentInclude)
      )
    }
  }

  if (model === "deployment") {
    if (include.guard) {
      const guard = guards.find((g) => g.id === row.guardId) || null
      if (!guard) {
        next.guard = null
      } else if (typeof include.guard === "object" && include.guard.select) {
        const selected: AnyRecord = {}
        const select = include.guard.select as AnyRecord
        for (const key of Object.keys(select)) {
          if (!select[key]) continue
          if (key === "attendances") {
            let rows = attendances.filter((a) => a.guardId === guard.id)
            rows = rows.filter((a) => matchWhere(a, select.attendances.where))
            rows = applyOrderBy(rows, select.attendances.orderBy)
            if (typeof select.attendances.take === "number") rows = rows.slice(0, select.attendances.take)
            selected.attendances = rows
          } else {
            selected[key] = (guard as AnyRecord)[key]
          }
        }
        if (!selected.attendances) selected.attendances = []
        next.guard = selected
      } else {
        next.guard = includeRelations("guard", guard, typeof include.guard === "object" ? include.guard.include : undefined)
      }
    }
    if (include.client) next.client = clients.find((c) => c.id === row.clientId) || null
    if (include.branch) next.branch = branches.find((b) => b.id === row.branchId) || null
    if (include.regionalOffice) next.regionalOffice = regionalOffices.find((o) => o.id === row.regionalOfficeId) || null
  }

  if (model === "user") {
    if (include.role) next.role = roles.find((r) => r.id === row.roleId) || null
    if (include.regionalOffice) next.regionalOffice = regionalOffices.find((o) => o.id === row.regionalOfficeId) || null
  }

  if (model === "regionalOffice") {
    if (include.region) next.region = regions.find((r) => r.id === row.regionId) || null
  }

  return next
}

function makeModelClient(model: string) {
  return {
    findMany: async (args: AnyRecord = {}) => {
      let rows = stores[model] || []
      rows = rows.filter((row) => matchWhere(row, args.where))
      rows = applyOrderBy(rows, args.orderBy)
      if (typeof args.skip === "number") rows = rows.slice(args.skip)
      if (typeof args.take === "number") rows = rows.slice(0, args.take)
      return rows.map((row) => includeRelations(model, row, args.include)).map((row) => {
        if (!args.select) return row
        const selected: AnyRecord = {}
        for (const key of Object.keys(args.select)) if (args.select[key]) selected[key] = row[key]
        return selected
      })
    },

    findUnique: async (args: AnyRecord = {}) => {
      const where = args.where || {}
      const row = (stores[model] || []).find((entry) => Object.entries(where).every(([k, v]) => entry[k] === v))
      if (!row) return null
      const included = includeRelations(model, row, args.include)
      if (!args.select) return included
      const selected: AnyRecord = {}
      for (const key of Object.keys(args.select)) if (args.select[key]) selected[key] = included[key]
      return selected
    },

    findFirst: async (args: AnyRecord = {}) => {
      const rows = await (makeModelClient(model).findMany as any)({ ...args, take: 1 })
      return rows[0] ?? null
    },

    count: async (args: AnyRecord = {}) => {
      const rows = (stores[model] || []).filter((row) => matchWhere(row, args.where))
      return rows.length
    },

    create: async (args: AnyRecord = {}) => {
      const data = { id: cuid(), ...args.data, createdAt: now(), updatedAt: now() }
      stores[model] = stores[model] || []
      stores[model].push(data)
      return includeRelations(model, data, args.include)
    },

    update: async (args: AnyRecord = {}) => {
      const where = args.where || {}
      const idx = (stores[model] || []).findIndex((entry) => Object.entries(where).every(([k, v]) => entry[k] === v))
      if (idx === -1) throw new Error(`Mock ${model} not found for update`)
      stores[model][idx] = { ...stores[model][idx], ...args.data, updatedAt: now() }
      return includeRelations(model, stores[model][idx], args.include)
    },

    upsert: async (args: AnyRecord = {}) => {
      const existing = await (makeModelClient(model).findUnique as any)({ where: args.where })
      if (existing) return (makeModelClient(model).update as any)({ where: args.where, data: args.update || {}, include: args.include })
      return (makeModelClient(model).create as any)({ data: args.create || {}, include: args.include })
    },

    delete: async (args: AnyRecord = {}) => {
      const where = args.where || {}
      const idx = (stores[model] || []).findIndex((entry) => Object.entries(where).every(([k, v]) => entry[k] === v))
      if (idx === -1) throw new Error(`Mock ${model} not found for delete`)
      const [deleted] = stores[model].splice(idx, 1)
      return deleted
    },
  }
}

export function createMockPrismaClient() {
  return new Proxy(
    {
      $disconnect: async () => undefined,
      $connect: async () => undefined,
      $transaction: async (cb: any) => (typeof cb === "function" ? cb(createMockPrismaClient()) : cb),
    } as AnyRecord,
    {
      get(target, prop: string) {
        if (prop in target) return target[prop]
        if (stores[prop]) return makeModelClient(prop)
        return makeModelClient(prop)
      },
    }
  )
}
