/**
 * Night-call rule engine.
 *
 * Given a set of NightCallLog rows for a guard over a date window, returns
 * the NightCallDeduction rows the policy mandates. Idempotent on
 * (guardId, date, type) — re-running over the same logs produces the same
 * deduction set.
 *
 * Spec (from DEDUCTIONS policy doc, section 6):
 *   - Control room places `callsPerNight` calls/night/guard.
 *   - 2 missed calls in one night     → TWO_MISSED         = 1 day deducted
 *   - Repeat next day                  → REPEATED_NEXT_DAY  = +1 day deducted
 *   - 1 missed × 2 consecutive days:
 *         day 1                         → CONSECUTIVE_DAY1_WARNING (0 days)
 *         day 2                         → CONSECUTIVE_DAY2_DEDUCTION (1 day)
 */

export type NightCallLog = {
  callTime: Date
  status: "PLACED" | "MISSED" | "ANSWERED" | string
}

export type NightCallRuleConfig = {
  twoMissedDeduction: number
  repeatedDayPenalty: number
  consecutiveOneMissedWarningDay: number
  consecutiveOneMissedDeductionDay: number
}

export type DerivedDeduction = {
  date: Date // first-of-day UTC for the affected day
  type:
    | "TWO_MISSED"
    | "REPEATED_NEXT_DAY"
    | "CONSECUTIVE_DAY1_WARNING"
    | "CONSECUTIVE_DAY2_DEDUCTION"
  daysDeducted: number
}

function dayKeyUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

function dayStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function nextDayUTC(d: Date): Date {
  const n = new Date(d.getTime())
  n.setUTCDate(n.getUTCDate() + 1)
  return n
}

export function deriveNightCallDeductions(
  logs: NightCallLog[],
  rule: NightCallRuleConfig
): DerivedDeduction[] {
  // Group missed counts per day
  const missedByDay = new Map<string, { day: Date; missed: number }>()
  for (const log of logs) {
    if (log.status !== "MISSED") continue
    const day = dayStartUTC(log.callTime)
    const key = dayKeyUTC(day)
    const existing = missedByDay.get(key)
    if (existing) existing.missed += 1
    else missedByDay.set(key, { day, missed: 1 })
  }

  const sortedDays = Array.from(missedByDay.values()).sort(
    (a, b) => a.day.getTime() - b.day.getTime()
  )

  const out: DerivedDeduction[] = []
  for (let i = 0; i < sortedDays.length; i++) {
    const today = sortedDays[i]
    const prev = i > 0 ? sortedDays[i - 1] : null
    const isConsecutive =
      prev !== null && nextDayUTC(prev.day).getTime() === today.day.getTime()

    if (today.missed >= 2) {
      // Did the previous day also have ≥2 missed? Then this is a REPEAT.
      if (isConsecutive && prev && prev.missed >= 2) {
        out.push({
          date: today.day,
          type: "REPEATED_NEXT_DAY",
          daysDeducted: rule.repeatedDayPenalty,
        })
      } else {
        out.push({
          date: today.day,
          type: "TWO_MISSED",
          daysDeducted: rule.twoMissedDeduction,
        })
      }
    } else if (today.missed === 1) {
      // Consecutive 1-missed across two days → day1 warning, day2 deduction
      const next = i + 1 < sortedDays.length ? sortedDays[i + 1] : null
      const nextIsConsecutiveSingleMissed =
        next !== null &&
        nextDayUTC(today.day).getTime() === next.day.getTime() &&
        next.missed === 1
      const prevWasSingleMissed =
        isConsecutive && prev !== null && prev.missed === 1

      if (prevWasSingleMissed) {
        out.push({
          date: today.day,
          type: "CONSECUTIVE_DAY2_DEDUCTION",
          daysDeducted: rule.consecutiveOneMissedDeductionDay,
        })
      } else if (nextIsConsecutiveSingleMissed) {
        out.push({
          date: today.day,
          type: "CONSECUTIVE_DAY1_WARNING",
          daysDeducted: 0,
        })
      }
      // single isolated 1-missed day → no deduction, no warning
    }
  }
  return out
}

export function payrollMonthFor(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}
