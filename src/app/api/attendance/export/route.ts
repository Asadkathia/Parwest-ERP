import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

type MonthSpan = {
    year: number
    month: number // 0-indexed
    label: string
    days: number
    start: Date
    end: Date
}

function monthsInRange(start: Date, end: Date): MonthSpan[] {
    const months: MonthSpan[] = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cursor <= last) {
        const y = cursor.getFullYear()
        const m = cursor.getMonth()
        const days = new Date(y, m + 1, 0).getDate()
        months.push({
            year: y,
            month: m,
            label: `${MONTH_LABELS[m]}-${y}`,
            days,
            start: new Date(y, m, 1, 0, 0, 0, 0),
            end: new Date(y, m + 1, 1, 0, 0, 0, 0),
        })
        cursor.setMonth(m + 1)
    }
    return months
}

const DAY_COL_START = 6 // F
const TOTAL_LABEL_COL = 37 // AK
const TOTAL_VALUE_COL = 38 // AL
const REMARKS_COL = 39 // AM
const SUPERVISOR_COL = 40 // AN
const MANAGER_COL = 41 // AO

type ShiftRowKey = "DAY_REGULAR" | "NIGHT_REGULAR" | "DAY_DOUBLE" | "NIGHT_DOUBLE"
const SHIFT_ORDER: { key: ShiftRowKey; label: string; totalLabel: string }[] = [
    { key: "DAY_REGULAR", label: "Day Regular", totalLabel: "Presents" },
    { key: "NIGHT_REGULAR", label: "Night Regular", totalLabel: "Presents" },
    { key: "DAY_DOUBLE", label: "Day Double Duty", totalLabel: "Time" },
    { key: "NIGHT_DOUBLE", label: "Night Double Duty", totalLabel: "Time" },
]

type AttendanceRecord = {
    date: Date
    status: string
    shiftType: string | null
    attendanceType: string | null
    deploymentId: string | null
}

function pickRowKeys(att: AttendanceRecord): ShiftRowKey[] {
    if (att.attendanceType === "DOUBLE_DUTY_DAY") return ["DAY_DOUBLE"]
    if (att.attendanceType === "DOUBLE_DUTY_NIGHT") return ["NIGHT_DOUBLE"]
    if (att.shiftType === "NIGHT") return ["NIGHT_REGULAR"]
    if (att.shiftType === "BOTH") return ["DAY_REGULAR", "NIGHT_REGULAR"]
    return ["DAY_REGULAR"]
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

        const managerScope = deriveManagerScope(session)
        const { searchParams } = new URL(request.url)
        const parwestId = searchParams.get("parwestId")?.trim()
        const guardIdParam = searchParams.get("guardId")?.trim()
        const startDateRaw = searchParams.get("startDate")
        const endDateRaw = searchParams.get("endDate")
        const regionId = searchParams.get("regionId")
        const regionalOfficeId = searchParams.get("regionalOfficeId")

        if (!parwestId && !guardIdParam) return badRequest("parwestId or guardId is required")
        if (managerScopeDenied(managerScope, { regionId, regionalOfficeId })) {
            return forbidden("Forbidden: requested scope is outside your assigned region.")
        }

        const guard = guardIdParam
            ? await prisma.guard.findUnique({
                  where: { id: guardIdParam },
                  select: {
                      id: true,
                      parwestId: true,
                      name: true,
                      status: true,
                      introducerName: true,
                      regionId: true,
                      regionalOfficeId: true,
                  },
              })
            : await prisma.guard.findFirst({
                  where: { parwestId: { equals: parwestId!, mode: "insensitive" } },
                  select: {
                      id: true,
                      parwestId: true,
                      name: true,
                      status: true,
                      introducerName: true,
                      regionId: true,
                      regionalOfficeId: true,
                  },
              })

        if (!guard) return notFound("Guard not found")
        if (managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
            return forbidden("Forbidden: guard is outside your scope.")
        }

        // Date range — default to current month if missing
        const now = new Date()
        const rangeStart = startDateRaw
            ? new Date(`${startDateRaw}T00:00:00`)
            : new Date(now.getFullYear(), now.getMonth(), 1)
        const rangeEnd = endDateRaw
            ? new Date(`${endDateRaw}T00:00:00`)
            : new Date(now.getFullYear(), now.getMonth() + 1, 0)

        const months = monthsInRange(rangeStart, rangeEnd)

        const scopeFilter = buildManagerScopeWhere(managerScope, {
            regionId: "regionId",
            regionalOfficeId: "regionalOfficeId",
        })

        // Supervisor (active assignment, latest)
        const supAssignment = await prisma.guardSupervisorAssignment.findFirst({
            where: { guardId: guard.id, status: "ACTIVE" },
            orderBy: { assignedAt: "desc" },
            include: { supervisor: { select: { id: true, name: true } } },
        })
        const supervisorName = supAssignment?.supervisor.name ?? ""

        // Manager via supervisor → manager mapping
        let managerName = ""
        if (supAssignment?.supervisorId) {
            const mgrAssignment = await prisma.managerSupervisorAssignment.findFirst({
                where: { supervisorId: supAssignment.supervisorId, status: "ACTIVE" },
                orderBy: { updatedAt: "desc" },
                include: { manager: { select: { id: true, name: true } } },
            })
            managerName = mgrAssignment?.manager.name ?? ""
        }

        // Deployments active during range
        const deployments = await prisma.deployment.findMany({
            where: {
                guardId: guard.id,
                deploymentDate: { lt: months[months.length - 1].end },
                OR: [{ endDate: null }, { endDate: { gte: months[0].start } }],
                ...(Object.keys(scopeFilter).length > 0 ? scopeFilter : {}),
            },
            include: {
                client: { select: { name: true } },
                branch: { select: { name: true, address: true } },
            },
            orderBy: { deploymentDate: "asc" },
        })

        // Attendance for the full range
        const attendances = await prisma.attendance.findMany({
            where: {
                guardId: guard.id,
                date: { gte: months[0].start, lt: months[months.length - 1].end },
            },
            select: {
                date: true,
                status: true,
                shiftType: true,
                attendanceType: true,
                deploymentId: true,
            },
            orderBy: { date: "asc" },
        })

        const workbook = new ExcelJS.Workbook()
        workbook.creator = "Parwest ERP"
        workbook.created = new Date()

        for (const span of months) {
            const sheet = workbook.addWorksheet(span.label)

            // Column widths
            sheet.getColumn(1).width = 6
            sheet.getColumn(2).width = 14
            sheet.getColumn(3).width = 26
            sheet.getColumn(4).width = 30
            sheet.getColumn(5).width = 18
            for (let i = DAY_COL_START; i <= DAY_COL_START + 30; i++) sheet.getColumn(i).width = 4
            sheet.getColumn(TOTAL_LABEL_COL).width = 10
            sheet.getColumn(TOTAL_VALUE_COL).width = 8
            sheet.getColumn(REMARKS_COL).width = 18
            sheet.getColumn(SUPERVISOR_COL).width = 20
            sheet.getColumn(MANAGER_COL).width = 20

            // Top header rows
            sheet.getCell(1, 1).value = `Attendance Month of: ${span.label}`
            sheet.getCell(1, 1).font = { bold: true, size: 12 }
            sheet.mergeCells(1, 1, 1, MANAGER_COL)
            sheet.getCell(1, 1).alignment = { horizontal: "center" }

            sheet.getCell(2, 1).value = "Manager Name:"
            sheet.getCell(2, 2).value = managerName
            sheet.getCell(2, 4).value = guard.parwestId
            sheet.getCell(2, 5).value = guard.name

            sheet.getCell(3, 1).value = "Supervisor Name:"
            sheet.getCell(3, 2).value = supervisorName
            sheet.getCell(3, 4).value = "Guard Status"
            sheet.getCell(3, 5).value = (guard.status ?? "").toLowerCase()

            sheet.getCell(4, 1).value = "Introducer Name:"
            sheet.getCell(4, 2).value = guard.introducerName ?? ""
            sheet.getCell(4, 4).value = "Guard Status"
            sheet.getCell(4, 5).value = "present"

            // Filter attendances + deployments for this month
            const monthAtt: AttendanceRecord[] = attendances
                .filter((a) => a.date >= span.start && a.date < span.end)
                .map((a) => ({
                    date: a.date,
                    status: a.status,
                    shiftType: a.shiftType,
                    attendanceType: a.attendanceType,
                    deploymentId: a.deploymentId,
                }))

            const monthDeps = deployments.filter(
                (d) => d.deploymentDate < span.end && (d.endDate == null || d.endDate >= span.start),
            )

            // Group attendance + deployments into blocks keyed by deploymentId (or "manual")
            const blockKeys: string[] = []
            const blockMeta = new Map<
                string,
                { rate: number | null; clientName: string; location: string }
            >()

            for (const dep of monthDeps) {
                const key = dep.id
                if (!blockMeta.has(key)) {
                    blockKeys.push(key)
                    blockMeta.set(key, {
                        rate: dep.salary ?? dep.rate ?? null,
                        clientName: dep.client?.name ?? "",
                        location: dep.branch?.name
                            ? `${dep.branch.name}${dep.branch.address ? `, ${dep.branch.address}` : ""}`
                            : (dep.branch?.address ?? ""),
                    })
                }
            }

            const attByBlock = new Map<string, AttendanceRecord[]>()
            for (const a of monthAtt) {
                const key = a.deploymentId && blockMeta.has(a.deploymentId) ? a.deploymentId : "__manual__"
                if (!blockMeta.has(key) && key === "__manual__") {
                    blockKeys.push(key)
                    blockMeta.set(key, { rate: null, clientName: "", location: "" })
                }
                if (!attByBlock.has(key)) attByBlock.set(key, [])
                attByBlock.get(key)!.push(a)
            }

            // If no blocks at all, render one empty block so the layout is still produced
            if (blockKeys.length === 0) {
                blockKeys.push("__manual__")
                blockMeta.set("__manual__", { rate: null, clientName: "", location: "" })
            }

            // Top-of-sheet summary aggregates (rows 5-7) + table header row 9
            // Header row 9
            const headerRow = 9
            sheet.getCell(headerRow, 1).value = "Sr. #."
            sheet.getCell(headerRow, 2).value = "Location Rate"
            sheet.getCell(headerRow, 3).value = "Client Name"
            sheet.getCell(headerRow, 4).value = "Location"
            sheet.getCell(headerRow, 5).value = "Shift"
            for (let d = 1; d <= 31; d++) {
                sheet.getCell(headerRow, DAY_COL_START + d - 1).value = d <= span.days ? d : null
            }
            sheet.getCell(headerRow, TOTAL_LABEL_COL).value = "Total"
            sheet.getCell(headerRow, REMARKS_COL).value = "Remarks"
            sheet.getCell(headerRow, SUPERVISOR_COL).value = "Supervisor"
            sheet.getCell(headerRow, MANAGER_COL).value = "Manager"
            sheet.getRow(headerRow).font = { bold: true }
            sheet.getRow(headerRow).alignment = { horizontal: "center" }

            // Build deployment blocks (4 rows each)
            let cursorRow = headerRow + 1
            let totalPresent = 0
            let regularPresent = 0
            let doublePresent = 0
            let firstDayRegularCount = 0
            let firstBlock = true

            blockKeys.forEach((key, blockIdx) => {
                const meta = blockMeta.get(key)!
                const blockAtt = attByBlock.get(key) ?? []

                // Compute per-row presents map
                const cellByRow: Record<ShiftRowKey, string[]> = {
                    DAY_REGULAR: Array(span.days).fill("A"),
                    NIGHT_REGULAR: Array(span.days).fill("A"),
                    DAY_DOUBLE: Array(span.days).fill("A"),
                    NIGHT_DOUBLE: Array(span.days).fill("A"),
                }

                for (const a of blockAtt) {
                    const dayIdx = a.date.getDate() - 1
                    if (dayIdx < 0 || dayIdx >= span.days) continue
                    const isPresent = a.status === "PRESENT"
                    const targets = pickRowKeys(a)
                    for (const t of targets) {
                        cellByRow[t][dayIdx] = isPresent ? "P" : "A"
                    }
                }

                const counts: Record<ShiftRowKey, number> = {
                    DAY_REGULAR: cellByRow.DAY_REGULAR.filter((v) => v === "P").length,
                    NIGHT_REGULAR: cellByRow.NIGHT_REGULAR.filter((v) => v === "P").length,
                    DAY_DOUBLE: cellByRow.DAY_DOUBLE.filter((v) => v === "P").length,
                    NIGHT_DOUBLE: cellByRow.NIGHT_DOUBLE.filter((v) => v === "P").length,
                }

                totalPresent += counts.DAY_REGULAR + counts.NIGHT_REGULAR + counts.DAY_DOUBLE + counts.NIGHT_DOUBLE
                regularPresent += counts.DAY_REGULAR + counts.NIGHT_REGULAR
                doublePresent += counts.DAY_DOUBLE + counts.NIGHT_DOUBLE

                if (firstBlock) {
                    firstDayRegularCount = counts.DAY_REGULAR
                    firstBlock = false
                }

                // Render 4 rows
                SHIFT_ORDER.forEach((shift, shiftIdx) => {
                    const r = cursorRow + shiftIdx
                    if (shiftIdx === 0) {
                        sheet.getCell(r, 1).value = blockIdx + 1
                        sheet.getCell(r, 2).value = meta.rate
                        sheet.getCell(r, 3).value = meta.clientName
                        sheet.getCell(r, 4).value = meta.location
                    }
                    sheet.getCell(r, 5).value = shift.label
                    const cells = cellByRow[shift.key]
                    for (let d = 0; d < span.days; d++) {
                        sheet.getCell(r, DAY_COL_START + d).value = cells[d]
                        sheet.getCell(r, DAY_COL_START + d).alignment = { horizontal: "center" }
                    }
                    sheet.getCell(r, TOTAL_LABEL_COL).value = shift.totalLabel
                    sheet.getCell(r, TOTAL_VALUE_COL).value = counts[shift.key]
                    if (shiftIdx === 0) {
                        sheet.getCell(r, SUPERVISOR_COL).value = supervisorName
                        sheet.getCell(r, MANAGER_COL).value = managerName
                    }
                })

                cursorRow += SHIFT_ORDER.length
            })

            // Top-right summary block (rows 5-7) and total in header (row 9 AL)
            sheet.getCell(5, 4).value = "Total Present"
            sheet.getCell(5, 5).value = totalPresent
            sheet.getCell(6, 4).value = "Regular Duty"
            sheet.getCell(6, 5).value = regularPresent
            sheet.getCell(7, 4).value = "Double Duty"
            sheet.getCell(7, 5).value = doublePresent
            sheet.getCell(headerRow, TOTAL_VALUE_COL).value = firstDayRegularCount

            // Borders for table area
            const tableLastRow = cursorRow - 1
            for (let r = headerRow; r <= tableLastRow; r++) {
                for (let c = 1; c <= MANAGER_COL; c++) {
                    sheet.getCell(r, c).border = {
                        top: { style: "thin" },
                        bottom: { style: "thin" },
                        left: { style: "thin" },
                        right: { style: "thin" },
                    }
                }
            }
        }

        const buffer = await workbook.xlsx.writeBuffer()
        const safeId = guard.parwestId.replace(/[^a-zA-Z0-9_-]/g, "_")
        const filename = `${safeId}.xlsx`

        return new NextResponse(buffer as ArrayBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (error: unknown) {
        console.error("Error exporting attendance:", error)
        return internalServerError("Failed to export attendance")
    }
}
