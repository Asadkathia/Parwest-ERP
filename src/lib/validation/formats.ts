export const CNIC_REGEX = /^\d{5}-\d{7}-\d$/
export const PHONE_REGEX = /^\+92-\d{3}-\d{7}$/

export function formatCnicDigits(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 13)
  if (d.length <= 5) return d
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`
}

export function isValidCnic(value: string): boolean {
  return CNIC_REGEX.test(value.trim())
}

export function isValidPhone(value: string): boolean {
  return PHONE_REGEX.test(value.trim())
}

export function calculateAgeYears(dateOfBirth: string, referenceDate?: string): number | null {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return null
  const ref = referenceDate ? new Date(referenceDate) : new Date()
  if (Number.isNaN(ref.getTime())) return null
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return age
}

export const MIN_GUARD_AGE = 18
export const MAX_GUARD_AGE = 65

export function isValidGuardAge(dob: string, referenceDate?: string): boolean {
  const age = calculateAgeYears(dob, referenceDate)
  if (age == null) return false
  return age >= MIN_GUARD_AGE && age <= MAX_GUARD_AGE
}

export function isNotFutureDate(value: string): boolean {
  if (!value) return false
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return d.getTime() <= today.getTime()
}

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4
  issues: string[]
  ok: boolean
}

export function checkPasswordStrength(pw: string, email?: string): PasswordStrength {
  const issues: string[] = []
  if (pw.length < 10) issues.push("at least 10 characters")
  if (!/[A-Z]/.test(pw)) issues.push("one uppercase letter")
  if (!/[a-z]/.test(pw)) issues.push("one lowercase letter")
  if (!/\d/.test(pw)) issues.push("one digit")
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push("one symbol")
  if (email) {
    const local = email.split("@")[0]?.toLowerCase()
    if (local && pw.toLowerCase().includes(local)) issues.push("must not contain your email")
  }
  const score = Math.max(0, Math.min(4, 4 - issues.length)) as PasswordStrength["score"]
  return { score, issues, ok: issues.length === 0 }
}
