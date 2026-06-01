export type GuardRate = {
  id: string; guardId: string; rate: number; extraHourRate: number | null
  isCurrentRate: boolean; rateStartDate: Date | null; rateEndDate: Date | null
}

export function selectGuardRate(rates: GuardRate[], guardId: string, asOf: Date): GuardRate | null {
  const t = asOf.getTime()
  return rates.filter((r) =>
    r.guardId === guardId &&
    (!r.rateStartDate || r.rateStartDate.getTime() <= t) &&
    (!r.rateEndDate || r.rateEndDate.getTime() >= t),
  ).sort((a, b) => Number(b.isCurrentRate) - Number(a.isCurrentRate) || (a.id < b.id ? -1 : 1))[0] ?? null
}
