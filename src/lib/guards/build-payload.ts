/**
 * Shared Guard create-payload builder.
 *
 * Both the single-create flow (`POST /api/guards`) and the bulk-import
 * persist function (`src/lib/imports/definitions/guards.ts`) call this
 * builder so the two paths converge on identical column writes. Past
 * production bugs came from the bulk path drifting away from single —
 * keeping one builder is the structural guarantee against that.
 *
 * The builder is intentionally synchronous and free of DB calls so it
 * can be unit-tested in isolation. DB-aware concerns (parwestId
 * generation, age-config lookup, regional-office resolution) stay in the
 * caller — this function only shapes already-resolved values into a
 * `Prisma.GuardCreateInput`-compatible row.
 */

import { coerceDate, coerceFloat, coerceInt, coerceString } from "@/lib/imports/coerce"

export type NearestRelative = Partial<{
  name: string
  fatherName: string
  relation: string
  cnic: string
  cnicIssueDate: string
  profession: string
  contact: string
  address: string
}>

export type FamilyMember = Partial<{
  name: string
  relation: string
  age: string
  profession: string
  address: string
  childCnic: string
  childAge: string
  childDob: string
}>

export type PreviousEmployment = Partial<{
  type: string
  isExService: boolean
  rank: string
  registrationNo: string
  unit: string
  years: string
  months: string
  dateOfEnrollment: string
  dateOfDischarge: string
  remarks: string
}>

export type GuardCreateRaw = {
  parwestId: string
  cnic: string
  name: string
  bodyRegionId: string | null
  bodyRegionalOfficeId: string | null
  // Flat scalar columns — anything that lands in a Guard model field.
  flat: Record<string, unknown>
  // Multi-entry collections, pre-assembled by the caller.
  nearestRelatives?: NearestRelative[]
  familyMembers?: FamilyMember[]
  previousEmployments?: PreviousEmployment[]
  // Optional bank-account list (single-create accepts JSON; bulk doesn't yet).
  bankAccounts?: Array<{
    bankName?: string
    accountNumber?: string
    accountType?: string
    iban?: string
    branchCode?: string
    walletType?: string
    isActive?: boolean
  }>
  // Pre-resolved ex-service classification.
  exServiceType: string
  isExService: boolean
}

export type GuardCreatePayload = Record<string, unknown> & {
  parwestId: string
  cnic: string
  name: string
}

/**
 * Builds the Prisma create payload for a Guard. All cell coercion goes
 * through `src/lib/imports/coerce.ts` so single-create + bulk follow the
 * same date / int / sentinel rules.
 *
 * `flat` is treated as a bag of raw cells keyed by Guard scalar column
 * name (e.g. `flat.fatherName`, `flat.dateOfBirth`). Unknown keys are
 * ignored. Date columns are coerced; numeric columns are coerced.
 */
export function buildGuardCreatePayload(input: GuardCreateRaw): GuardCreatePayload {
  const f = input.flat
  const activeAccount =
    input.bankAccounts?.find((a) => a.isActive) ?? input.bankAccounts?.[0] ?? null

  const fe =
    input.previousEmployments?.find((e) => e.type === input.exServiceType) ??
    input.previousEmployments?.[0] ??
    null

  return {
    parwestId: input.parwestId,
    name: input.name,
    cnic: input.cnic,
    phone: coerceString(f.phone),
    email: coerceString(f.email),
    dateOfBirth: coerceDate(f.dateOfBirth),
    age: coerceInt(f.age),
    fatherName: coerceString(f.fatherName),
    motherName: coerceString(f.motherName),
    nationality: coerceString(f.nationality),
    nextOfKin: coerceString(f.nextOfKin),
    religion: coerceString(f.religion),
    maritalStatus: coerceString(f.maritalStatus),
    education: coerceString(f.education),
    addressPermanent: coerceString(f.addressPermanent),
    addressCurrent: coerceString(f.addressCurrent),
    emergencyContact: coerceString(f.emergencyContact),
    additionalContactNumbers: coerceString(f.additionalContactNumbers),
    profileIntroducer: coerceString(f.profileIntroducer),
    nearestRelativesJson:
      input.nearestRelatives && input.nearestRelatives.length > 0
        ? JSON.stringify(input.nearestRelatives)
        : null,
    status: coerceString(f.status) || "PENDING",
    lifecycleStatus: "PENDING",
    sect: coerceString(f.sect),
    cast: coerceString(f.cast),
    bloodGroup: coerceString(f.bloodGroup),
    policeStation: coerceString(f.policeStation),
    cnicIssueDate: coerceDate(f.cnicIssueDate),
    cnicExpiryDate: coerceDate(f.cnicExpiryDate),
    salary: coerceFloat(f.salary),
    designation: coerceString(f.designation),
    joiningDate: coerceDate(f.joiningDate),
    joiningAge: coerceInt(f.joiningAge),
    enrolledBy: coerceString(f.enrolledBy),
    isExService: input.isExService,
    exServiceType: input.exServiceType,
    exServiceRank: coerceString(f.exServiceRank) ?? coerceString(fe?.rank),
    exServiceRegiment: coerceString(f.exServiceRegiment) ?? coerceString(fe?.unit),
    exServiceRegistrationNo: coerceString(f.exServiceRegistrationNo) ?? coerceString(fe?.registrationNo),
    exServiceUnit: coerceString(f.exServiceUnit) ?? coerceString(fe?.unit),
    exServicePeriod: coerceString(f.exServicePeriod),
    exServiceYears: coerceInt(f.exServiceYears) ?? coerceInt(fe?.years),
    exServiceMonths: coerceInt(f.exServiceMonths) ?? coerceInt(fe?.months),
    exServiceOtherLabel: coerceString(f.exServiceOtherLabel),
    dateOfEnrollment: coerceDate(f.dateOfEnrollment) ?? coerceDate(fe?.dateOfEnrollment),
    dateOfDischarge: coerceDate(f.dateOfDischarge) ?? coerceDate(fe?.dateOfDischarge),
    exServiceRemarks: coerceString(f.exServiceRemarks) ?? coerceString(fe?.remarks),
    currentAddressContact: coerceString(f.currentAddressContact),
    permanentAddressContact: coerceString(f.permanentAddressContact),
    passingYear: coerceString(f.passingYear),
    educationInstitute: coerceString(f.educationInstitute),
    introducerName: coerceString(f.introducerName),
    introducerCnic: coerceString(f.introducerCnic),
    introducerAddress: coerceString(f.introducerAddress),
    introducerContact: coerceString(f.introducerContact),
    height: coerceString(f.height),
    weight: coerceString(f.weight),
    eyeColor: coerceString(f.eyeColor),
    hairColor: coerceString(f.hairColor),
    disability: coerceString(f.disability),
    identificationMark: coerceString(f.identificationMark),
    familyMembersJson:
      input.familyMembers && input.familyMembers.length > 0
        ? JSON.stringify(input.familyMembers)
        : null,
    previousEmploymentsJson:
      input.previousEmployments && input.previousEmployments.length > 0
        ? JSON.stringify(input.previousEmployments)
        : null,
    bankName: activeAccount?.bankName || coerceString(f.bankName),
    bankAccountNumber: activeAccount?.accountNumber || coerceString(f.bankAccountNumber),
    bankAccountType: activeAccount?.accountType || coerceString(f.bankAccountType),
    bankIban: activeAccount?.iban || coerceString(f.bankIban),
    bankBranchCode: activeAccount?.branchCode || coerceString(f.bankBranchCode),
    bankAccountsJson:
      input.bankAccounts && input.bankAccounts.length > 0
        ? JSON.stringify(input.bankAccounts)
        : null,
    regionId: input.bodyRegionId,
    regionalOfficeId: input.bodyRegionalOfficeId,
  }
}
