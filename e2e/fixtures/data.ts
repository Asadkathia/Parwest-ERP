export function runId(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `QA${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${pad(d.getMilliseconds()).slice(0, 2)}`
}

// Produces a valid CNIC matching ^\d{5}-\d{7}-\d$
// Uses the process pid + timestamp to minimize collision across parallel runs.
export function cnic(): string {
  const base = Date.now().toString() + process.pid.toString()
  const digits = base.replace(/\D/g, "").padEnd(13, "0")
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`
}

// Valid phone per form regex ^\+92-\d{3}-\d{7}$
export function phone(suffix: number = 1): string {
  const seven = String(1234560 + suffix).padStart(7, "0").slice(-7)
  return `+92-300-${seven}`
}

export function isoDate(offsetDays: number = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export const PARWEST_ID_RE = /^PW-[A-Z]+-\d{5}$/
