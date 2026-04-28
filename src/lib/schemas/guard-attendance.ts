import { z } from "zod"

/**
 * Schema for the Guards → Attendance tab per-day editor.
 *
 * Mirrors the body accepted by:
 *   POST /api/attendance/route.ts (upsert by guardId+date).
 *
 * The server is the source of truth for validation — this client schema
 * only validates user input shape and provides friendly messages.
 *
 * Status values are intentionally kept aligned with the legacy attendance
 * type configuration (PRESENT / ABSENT / LEAVE / HOLIDAY plus the special
 * duty variants reflected as attendanceType strings).
 */

export const ATTENDANCE_STATUS_VALUES = [
    "PRESENT",
    "ABSENT",
    "LEAVE",
    "HOLIDAY",
] as const

export type AttendanceStatusValue = (typeof ATTENDANCE_STATUS_VALUES)[number]

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatusValue, string> = {
    PRESENT: "Present",
    ABSENT: "Absent",
    LEAVE: "Leave",
    HOLIDAY: "Holiday",
}

export const ATTENDANCE_SHIFT_VALUES = ["DAY", "NIGHT"] as const
export type AttendanceShiftValue = (typeof ATTENDANCE_SHIFT_VALUES)[number]

const optionalTime = z
    .string()
    .trim()
    .max(8, "Time is too long")
    .optional()
    .or(z.literal(""))

export const guardAttendanceDayEditSchema = z.object({
    status: z.enum(ATTENDANCE_STATUS_VALUES, {
        message: "Status is required",
    }),
    shiftType: z
        .enum(ATTENDANCE_SHIFT_VALUES)
        .optional()
        .or(z.literal("")),
    checkIn: optionalTime,
    checkOut: optionalTime,
    hours: z
        .string()
        .trim()
        .max(6, "Hours is too long")
        .optional()
        .or(z.literal("")),
    notes: z
        .string()
        .trim()
        .max(500, "Notes are too long")
        .optional()
        .or(z.literal("")),
})

export type GuardAttendanceDayEditInput = z.infer<
    typeof guardAttendanceDayEditSchema
>
