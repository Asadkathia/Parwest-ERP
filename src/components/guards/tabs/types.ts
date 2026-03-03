export type GuardLooseRow = Record<string, unknown>

export type AttendanceRecord = {
  date: string | Date
  status: string
  shift?: string
  hours?: number | string
  overtime?: number | string
  reason?: string | null
}

export type AttendanceSummary = {
  totalDays?: number | string
  present?: number | string
  absent?: number | string
  overtime?: number | string
}

export type PaidSalaryRecord = {
  month: string
  amount: number
  deductions: number
  netAmount: number
  method: string
  paidOn: string
  status: string
}

export type NearestRelative = {
  name?: string
  fatherName?: string
  relation?: string
  profession?: string
  cnic?: string
  contact?: string
  address?: string
}

export type GuardTabModel = {
  id?: string
  parwestId?: string
  name?: string
  cnic?: string
  status?: string
  dateOfBirth?: string | Date | null
  joiningDate?: string | Date | null
  age?: number | null
  fatherName?: string | null
  motherName?: string | null
  religion?: string | null
  maritalStatus?: string | null
  education?: string | null
  nationality?: string | null
  nextOfKin?: string | null
  profileIntroducer?: string | null
  phone?: string | null
  email?: string | null
  emergencyContact?: string | null
  additionalContactNumbers?: string | null
  phoneSecondary?: string | null
  addressPermanent?: string | null
  addressCurrent?: string | null
  regionalOffice?: string | { name?: string | null } | null
  region?: GuardLooseRow | null
  managerName?: string | null
  enrolledBy?: string | null
  joiningAge?: number | null
  isExService?: boolean
  nearestRelatives?: NearestRelative[]
  attachments?: GuardLooseRow[]
  attendance?: AttendanceRecord[]
  attendanceSummary?: AttendanceSummary
  inventory?: GuardLooseRow[]
  salaries?: PaidSalaryRecord[]
  deployments?: GuardLooseRow[]
  courses?: GuardLooseRow[]
  verifications?: GuardLooseRow[]
  pledgedDocuments?: GuardLooseRow[]
  bankDetails?: GuardLooseRow
  residenceHistory?: GuardLooseRow[]
  ojtTrainings?: GuardLooseRow[]
  storeInventory?: GuardLooseRow[]
  serviceHistory?: GuardLooseRow[]
  insurance?: GuardLooseRow[]
  statusHistory?: GuardLooseRow[]
  pbaDocuments?: GuardLooseRow[]
}
