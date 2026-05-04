import { CronExpressionParser } from "cron-parser"

export function nextRunAt(
  cron: string,
  tz: string,
  after: Date = new Date()
): Date {
  const it = CronExpressionParser.parse(cron, { tz, currentDate: after })
  return it.next().toDate()
}
