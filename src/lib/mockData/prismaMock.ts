import { mockGuardProfile, mockGuardsList, mockResidences, mockTrainings } from "@/lib/mockData/guards"
import { mockClientsList } from "@/lib/mockData/clients"
import { mockDeploymentsList } from "@/lib/mockData/deployments"

type AnyRecord = Record<string, unknown>
type MockTransactionCallback = (client: ReturnType<typeof createMockPrismaClient>) => unknown

function asRecord(value: unknown): AnyRecord {
  return (value && typeof value === "object" ? value : {}) as AnyRecord
}

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

const guards = mockGuardsList.map((g, idx) => {
  const guard = g as {
    id: string
    parwestId: string
    name: string
    cnic: string
    phone?: string | null
    email?: string | null
    dateOfBirth?: string | Date | null
    age?: number | null
    fatherName?: string | null
    religion?: string | null
    maritalStatus?: string | null
    education?: string | null
    addressPermanent?: string | null
    addressCurrent?: string | null
    emergencyContact?: string | null
    status: string
    isExService?: boolean
    bankName?: string | null
    bankAccountNumber?: string | null
    bankAccountType?: string | null
    joiningDate?: string | Date | null
    bankDetails?: {
      bankName?: string | null
      accountNumber?: string | null
      accountType?: string | null
    } | null
  }

  return {
  id: guard.id,
  parwestId: guard.parwestId,
  name: guard.name,
  cnic: guard.cnic,
  phone: guard.phone || null,
  email: guard.email || null,
  dateOfBirth: guard.dateOfBirth ? new Date(guard.dateOfBirth) : null,
  age: guard.age ?? null,
  fatherName: guard.fatherName || null,
  religion: guard.religion || null,
  maritalStatus: guard.maritalStatus || null,
  education: guard.education || null,
  addressPermanent: guard.addressPermanent || null,
  addressCurrent: guard.addressCurrent || null,
  emergencyContact: guard.emergencyContact || null,
  status: guard.status,
  isExService: Boolean(guard.isExService),
  exServiceRank: null,
  exServiceRegiment: null,
  bankName: guard.bankName || guard.bankDetails?.bankName || null,
  bankAccountNumber: guard.bankAccountNumber || guard.bankDetails?.accountNumber || null,
  bankAccountType: guard.bankAccountType || guard.bankDetails?.accountType || "SAVING",
  joiningDate: guard.joiningDate ? new Date(guard.joiningDate) : null,
  regionalOfficeId: "office-lhr",
  regionId: idx % 2 === 0 ? "lahore" : "karachi",
  createdAt: now(),
  updatedAt: now(),
}})

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

const attendances = guards.flatMap((g) => {
  const base = mockGuardProfile.attendance || []
  if (!base.length) return []
  return base.slice(0, 5).map((a, i: number) => {
    const attendance = a as { date?: string | Date; status?: string; shift?: string; reason?: string | null }
    return ({
    id: `att-${g.id}-${i}`,
    guardId: g.id,
    date: new Date(attendance.date || now()),
    status: attendance.status || "PRESENT",
    shiftType: attendance.shift || "DAY",
    notes: attendance.reason || null,
    createdAt: now(),
    updatedAt: now(),
  })})
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

const trainings = mockTrainings.map((t) => {
  const training = t as {
    id: string
    regionalOffice?: string | null
    client?: string | null
    branch?: string | null
    supervisor?: string | null
    branchSupervisor?: string | null
    manager?: string | null
    branchManager?: string | null
    guardName?: string | null
    guards?: string | null
    guardId?: string | null
    trainedBy?: string | null
    conductedBy?: string | null
    date?: string | Date
    dateOfOJT?: string | Date
    armored?: boolean
    armorer?: unknown
    remarks?: string | null
  }

  return ({
  id: training.id,
  regionalOffice: training.regionalOffice,
  client: training.client,
  branch: training.branch,
  supervisor: training.supervisor || training.branchSupervisor || null,
  manager: training.manager || training.branchManager || null,
  guardName: training.guardName || training.guards || null,
  guardId: training.guardId || null,
  trainedBy: training.trainedBy || training.conductedBy || null,
  date: new Date(training.date || training.dateOfOJT || now()),
  armored: training.armored ?? (training.armorer ? true : false),
  remarks: training.remarks,
  createdAt: now(),
  updatedAt: now(),
})})

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
      const containsValue = (value as { contains?: unknown }).contains
      return String(row[key] ?? "").toLowerCase().includes(String(containsValue).toLowerCase())
    }
    if (value && typeof value === "object" && ("gte" in value || "lte" in value)) {
      const rowValue = row[key] as string | number | Date | undefined
      const rv = rowValue instanceof Date ? rowValue.getTime() : new Date(rowValue || 0).getTime()
      const range = value as { gte?: string | Date; lte?: string | Date }
      const gte = range.gte ? new Date(range.gte).getTime() : null
      const lte = range.lte ? new Date(range.lte).getTime() : null
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
    const av = a[key] as string | number | boolean | Date | null | undefined
    const bv = b[key] as string | number | boolean | Date | null | undefined
    if (av === bv) return 0
    if (av == null) return -1
    if (bv == null) return 1
    const out = av > bv ? 1 : -1
    return dir === "desc" ? -out : out
  })
}

function includeRelations(model: string, row: AnyRecord, include: AnyRecord | undefined) {
  const includeObj = asRecord(include)
  if (!Object.keys(includeObj).length) return row
  const next = { ...row }

  if (model === "guard") {
    if (includeObj.region) next.region = regions.find((r) => r.id === row.regionId) || null
    if (includeObj.regionalOffice) next.regionalOffice = regionalOffices.find((o) => o.id === row.regionalOfficeId) || null
    if (includeObj.attendances) {
      const attendanceInclude = asRecord(includeObj.attendances)
      let rows = attendances.filter((a) => a.guardId === row.id)
      rows = rows.filter((a) => matchWhere(a, asRecord(attendanceInclude.where)))
      rows = applyOrderBy(rows, asRecord(attendanceInclude.orderBy))
      if (typeof attendanceInclude.take === "number") rows = rows.slice(0, attendanceInclude.take)
      next.attendances = rows
    }
  }

  if (model === "client") {
    if (includeObj.region) next.region = regions.find((r) => r.id === row.regionId) || null
    if (includeObj.branches) {
      const branchArgs = asRecord(includeObj.branches)
      const branchInclude = asRecord(branchArgs.include)
      const branchOrderBy = asRecord(branchArgs.orderBy)
      let clientBranches = branches.filter((b) => b.clientId === row.id)
      clientBranches = applyOrderBy(clientBranches, branchOrderBy)
      next.branches = clientBranches.map((b) => includeRelations("branch", b, branchInclude))
    }
    if (includeObj._count) next._count = { branches: branches.filter((b) => b.clientId === row.id).length }
  }

  if (model === "branch") {
    if (includeObj.client) next.client = clients.find((c) => c.id === row.clientId) || null
    if (includeObj.deployments) {
      const deploymentArgs = asRecord(includeObj.deployments)
      const whereStatus = asRecord(deploymentArgs.where).status
      const branchDeployments = deployments.filter((d) => d.branchId === row.id)
      const deploymentRows = whereStatus ? branchDeployments.filter((d) => d.status === whereStatus) : branchDeployments
      const deploymentInclude = asRecord(deploymentArgs.include)
      const deploymentOrderBy = asRecord(deploymentArgs.orderBy)
      next.deployments = applyOrderBy(deploymentRows, deploymentOrderBy).map((d) =>
        includeRelations("deployment", d, deploymentInclude)
      )
    }
  }

  if (model === "deployment") {
    if (includeObj.guard) {
      const guard = guards.find((g) => g.id === row.guardId) || null
      if (!guard) {
        next.guard = null
      } else if (asRecord(includeObj.guard).select) {
        const selected: AnyRecord = {}
        const select = asRecord(asRecord(includeObj.guard).select)
        for (const key of Object.keys(select)) {
          if (!select[key]) continue
          if (key === "attendances") {
            const attendanceSelect = asRecord(select.attendances)
            let rows = attendances.filter((a) => a.guardId === guard.id)
            rows = rows.filter((a) => matchWhere(a, asRecord(attendanceSelect.where)))
            rows = applyOrderBy(rows, asRecord(attendanceSelect.orderBy))
            if (typeof attendanceSelect.take === "number") rows = rows.slice(0, attendanceSelect.take)
            selected.attendances = rows
          } else {
            selected[key] = guard[key as keyof typeof guard]
          }
        }
        if (!selected.attendances) selected.attendances = []
        next.guard = selected
      } else {
        next.guard = includeRelations("guard", guard, asRecord(asRecord(includeObj.guard).include))
      }
    }
    if (includeObj.client) next.client = clients.find((c) => c.id === row.clientId) || null
    if (includeObj.branch) next.branch = branches.find((b) => b.id === row.branchId) || null
    if (includeObj.regionalOffice) next.regionalOffice = regionalOffices.find((o) => o.id === row.regionalOfficeId) || null
  }

  if (model === "user") {
    if (includeObj.role) next.role = roles.find((r) => r.id === row.roleId) || null
    if (includeObj.regionalOffice) next.regionalOffice = regionalOffices.find((o) => o.id === row.regionalOfficeId) || null
  }

  if (model === "regionalOffice") {
    if (includeObj.region) next.region = regions.find((r) => r.id === row.regionId) || null
  }

  return next
}

function makeModelClient(model: string) {
  return {
    findMany: async (args: AnyRecord = {}) => {
      const query = asRecord(args)
      let rows = stores[model] || []
      rows = rows.filter((row) => matchWhere(row, asRecord(query.where)))
      rows = applyOrderBy(rows, asRecord(query.orderBy))
      if (typeof query.skip === "number") rows = rows.slice(query.skip)
      if (typeof query.take === "number") rows = rows.slice(0, query.take)
      return rows.map((row) => includeRelations(model, row, asRecord(query.include))).map((row) => {
        if (!query.select) return row
        const selectedFields = asRecord(query.select)
        const selected: AnyRecord = {}
        for (const key of Object.keys(selectedFields)) if (selectedFields[key]) selected[key] = row[key]
        return selected
      })
    },

    findUnique: async (args: AnyRecord = {}) => {
      const query = asRecord(args)
      const where = asRecord(query.where)
      const row = (stores[model] || []).find((entry) => Object.entries(where).every(([k, v]) => entry[k] === v))
      if (!row) return null
      const included = includeRelations(model, row, asRecord(query.include))
      if (!query.select) return included
      const selectedFields = asRecord(query.select)
      const selected: AnyRecord = {}
      for (const key of Object.keys(selectedFields)) if (selectedFields[key]) selected[key] = included[key]
      return selected
    },

    findFirst: async (args: AnyRecord = {}) => {
      const rows = (await makeModelClient(model).findMany({ ...args, take: 1 })) as AnyRecord[]
      return rows[0] ?? null
    },

    count: async (args: AnyRecord = {}) => {
      const query = asRecord(args)
      const rows = (stores[model] || []).filter((row) => matchWhere(row, asRecord(query.where)))
      return rows.length
    },

    create: async (args: AnyRecord = {}) => {
      const query = asRecord(args)
      const data = { id: cuid(), ...asRecord(query.data), createdAt: now(), updatedAt: now() }
      stores[model] = stores[model] || []
      stores[model].push(data)
      return includeRelations(model, data, asRecord(query.include))
    },

    update: async (args: AnyRecord = {}) => {
      const query = asRecord(args)
      const where = asRecord(query.where)
      const idx = (stores[model] || []).findIndex((entry) => Object.entries(where).every(([k, v]) => entry[k] === v))
      if (idx === -1) throw new Error(`Mock ${model} not found for update`)
      stores[model][idx] = { ...stores[model][idx], ...asRecord(query.data), updatedAt: now() }
      return includeRelations(model, stores[model][idx], asRecord(query.include))
    },

    upsert: async (args: AnyRecord = {}) => {
      const query = asRecord(args)
      const existing = await makeModelClient(model).findUnique({ where: query.where })
      if (existing) return makeModelClient(model).update({ where: query.where, data: asRecord(query.update), include: query.include })
      return makeModelClient(model).create({ data: asRecord(query.create), include: query.include })
    },

    delete: async (args: AnyRecord = {}) => {
      const query = asRecord(args)
      const where = asRecord(query.where)
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
      $transaction: async (
        cb: unknown
      ) => (typeof cb === "function" ? (cb as MockTransactionCallback)(createMockPrismaClient()) : cb),
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
