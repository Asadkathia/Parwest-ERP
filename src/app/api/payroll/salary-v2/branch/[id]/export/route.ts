import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { parseMonthRange as parseMonth } from "@/lib/payroll/date-helpers"

const PKR = (n: number) => `PKR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function pad(n: number) {
    return n.toString().padStart(2, "0")
}

function formatTimestamp(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")

        const { id: branchId } = await params
        const monthRaw = new URL(request.url).searchParams.get("month")
        if (!monthRaw) return badRequest("month is required.")
        const month = parseMonth(monthRaw)
        if (!month) return badRequest("Invalid month value.")

        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            include: {
                client: { select: { name: true } },
                regionalOffice: { select: { regionId: true } },
            },
        })
        if (!branch) return notFound("Branch not found.")

        const scope = deriveManagerScope(session)
        // Clients are region-less; scope the branch by its OWN office region.
        if (
            managerScopeDenied(scope, {
                regionId: branch.regionalOffice?.regionId ?? null,
                regionalOfficeId: branch.regionalOfficeId ?? null,
            })
        ) {
            return notFound("Branch not found.")
        }

        const [managerUser, supervisorAssignment] = await Promise.all([
            branch.assignedManagerId
                ? prisma.user.findUnique({
                      where: { id: branch.assignedManagerId },
                      select: { name: true },
                  })
                : Promise.resolve(null),
            prisma.clientSupervisorAssignment.findFirst({
                where: { branchId: branch.id, status: "ACTIVE" },
                orderBy: { createdAt: "desc" },
                include: { supervisor: { select: { name: true } } },
            }),
        ])

        const deployments = await prisma.deployment.findMany({
            where: {
                branchId: branch.id,
                deploymentDate: { gte: month.start, lt: month.end },
            },
            include: {
                guard: { select: { id: true, parwestId: true, name: true } },
            },
        })

        type GuardAgg = {
            guardId: string
            parwestId: string
            guardName: string
            guardType: string | null
            isExtraGuard: boolean
            regularWage: number
            overtimeWage: number
            postAllowance: number
            uniqueDays: Set<string>
            overtimeDays: number
        }
        const byGuard = new Map<string, GuardAgg>()

        for (const dep of deployments) {
            const isExtra = dep.isExtraGuard || dep.deploymentType === "EXTRA"
            if (!byGuard.has(dep.guardId)) {
                byGuard.set(dep.guardId, {
                    guardId: dep.guardId,
                    parwestId: dep.guard.parwestId,
                    guardName: dep.guard.name,
                    guardType: dep.guardType,
                    isExtraGuard: isExtra,
                    regularWage: 0,
                    overtimeWage: 0,
                    postAllowance: 0,
                    uniqueDays: new Set(),
                    overtimeDays: 0,
                })
            }
            const row = byGuard.get(dep.guardId)!
            const baseRate = Number(dep.salary ?? dep.rate ?? 0)
            const overtime = Number(dep.overtime ?? 0)
            const post = Number(dep.postAllowance ?? 0)
            if (dep.deploymentType === "OVERTIME") {
                row.overtimeWage += baseRate + overtime
                row.overtimeDays += 1
            } else {
                row.regularWage += baseRate
                row.overtimeWage += overtime
            }
            row.postAllowance += post
            row.uniqueDays.add(dep.deploymentDate.toISOString().slice(0, 10))
        }

        const guardIds = Array.from(byGuard.keys())
        const payrollRows = await prisma.payroll.findMany({
            where: {
                guardId: { in: guardIds },
                month: { gte: month.start, lt: month.end },
                year: month.year,
            },
            select: { guardId: true, loans: true, netSalary: true },
        })
        const payrollByGuard = new Map(payrollRows.map((p) => [p.guardId, p]))

        const rows = Array.from(byGuard.values()).map((g, i) => {
            const totalDays = g.uniqueDays.size
            const regularWage = g.regularWage
            const overtimeWage = g.overtimeWage
            const postAllowance = g.postAllowance
            const grossPay = regularWage + overtimeWage + postAllowance
            const payroll = payrollByGuard.get(g.guardId)
            const loanDeduction = Number(payroll?.loans ?? 0)
            const netPayable = Number(payroll?.netSalary ?? grossPay - loanDeduction)
            return {
                sr: i + 1,
                parwestId: g.parwestId,
                guardName: g.guardName,
                guardType: g.guardType ?? "",
                extraGuard: g.isExtraGuard ? "Yes" : "No",
                totalDays,
                overtimeDays: g.overtimeDays,
                regularWage,
                overtimeWage,
                postAllowance,
                grossPay,
                loanDeduction,
                netPayable,
            }
        })

        const grand = rows.reduce(
            (acc, r) => ({
                totalDays: acc.totalDays + r.totalDays,
                overtimeDays: acc.overtimeDays + r.overtimeDays,
                regularWage: acc.regularWage + r.regularWage,
                overtimeWage: acc.overtimeWage + r.overtimeWage,
                postAllowance: acc.postAllowance + r.postAllowance,
                grossPay: acc.grossPay + r.grossPay,
                loanDeduction: acc.loanDeduction + r.loanDeduction,
                netPayable: acc.netPayable + r.netPayable,
            }),
            {
                totalDays: 0,
                overtimeDays: 0,
                regularWage: 0,
                overtimeWage: 0,
                postAllowance: 0,
                grossPay: 0,
                loanDeduction: 0,
                netPayable: 0,
            },
        )

        const extraDays = rows.filter((r) => r.extraGuard === "Yes").reduce((s, r) => s + r.totalDays, 0)
        const monthLabel = month.start.toISOString().slice(0, 7) // YYYY-MM
        const generatedAt = new Date()

        const wb = new ExcelJS.Workbook()
        wb.creator = "Parwest ERP"
        wb.created = generatedAt
        const sheet = wb.addWorksheet("Branch Salary")

        // Column widths
        const widths = [6, 14, 26, 14, 12, 11, 12, 16, 16, 16, 16, 16, 16]
        widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w))

        sheet.getCell("A1").value = "Branch Salary Details Report"
        sheet.getCell("A1").font = { bold: true, size: 14 }
        sheet.mergeCells("A1:M1")
        sheet.getCell("A1").alignment = { horizontal: "center" }

        sheet.getCell("A2").value = "Branch Name:"
        sheet.getCell("B2").value = branch.name
        sheet.getCell("A3").value = "Client Name:"
        sheet.getCell("B3").value = branch.client?.name ?? ""
        sheet.getCell("A4").value = "Salary Month:"
        sheet.getCell("B4").value = monthLabel
        sheet.getCell("A5").value = "Generated On:"
        sheet.getCell("B5").value = formatTimestamp(generatedAt)
        sheet.getCell("A6").value = "Manager:"
        sheet.getCell("B6").value = managerUser?.name ?? ""
        sheet.getCell("A7").value = "Supervisor:"
        sheet.getCell("B7").value = supervisorAssignment?.supervisor.name ?? ""

        for (let r = 2; r <= 7; r++) sheet.getCell(`A${r}`).font = { bold: true }

        const headerRow = 9
        const headers = [
            "Sr#",
            "Parwest ID",
            "Guard Name",
            "Guard Type",
            "Extra Guard",
            "Total Days",
            "Overtime Days",
            "Regular Wage",
            "Overtime Wage",
            "Post Allowance",
            "Gross Pay",
            "Loan Deduction",
            "Net Payable",
        ]
        headers.forEach((h, i) => {
            const cell = sheet.getCell(headerRow, i + 1)
            cell.value = h
            cell.font = { bold: true }
            cell.alignment = { horizontal: "center" }
            cell.border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
            }
        })

        let r = headerRow + 1
        for (const row of rows) {
            const values = [
                row.sr,
                row.parwestId,
                row.guardName,
                row.guardType,
                row.extraGuard,
                row.totalDays,
                row.overtimeDays,
                PKR(row.regularWage),
                PKR(row.overtimeWage),
                PKR(row.postAllowance),
                PKR(row.grossPay),
                PKR(row.loanDeduction),
                PKR(row.netPayable),
            ]
            values.forEach((v, i) => {
                const cell = sheet.getCell(r, i + 1)
                cell.value = v as string | number
                cell.border = {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" },
                }
            })
            r++
        }

        // Grand Total row (label in column E)
        sheet.getCell(r, 5).value = "Grand Total"
        sheet.getCell(r, 5).font = { bold: true }
        sheet.getCell(r, 6).value = grand.totalDays
        sheet.getCell(r, 7).value = grand.overtimeDays
        sheet.getCell(r, 8).value = PKR(grand.regularWage)
        sheet.getCell(r, 9).value = PKR(grand.overtimeWage)
        sheet.getCell(r, 10).value = PKR(grand.postAllowance)
        sheet.getCell(r, 11).value = PKR(grand.grossPay)
        sheet.getCell(r, 12).value = PKR(grand.loanDeduction)
        sheet.getCell(r, 13).value = PKR(grand.netPayable)
        for (let c = 5; c <= 13; c++) sheet.getCell(r, c).font = { bold: true }
        r++

        sheet.getCell(r, 5).value = "Extra Days:"
        sheet.getCell(r, 6).value = extraDays
        sheet.getCell(r, 7).value = 0
        r++
        sheet.getCell(r, 5).value = "Total Extra Days:"
        sheet.getCell(r, 6).value = extraDays
        r++
        sheet.getCell(r, 5).value = "Total Days:"
        sheet.getCell(r, 6).value = grand.totalDays
        r += 2

        sheet.getCell(r, 11).value = "Total Loan Deduction:"
        sheet.getCell(r, 12).value = PKR(grand.loanDeduction)
        sheet.getCell(r, 11).font = { bold: true }
        r++
        sheet.getCell(r, 12).value = "Total Branch Salary:"
        sheet.getCell(r, 13).value = PKR(grand.netPayable)
        sheet.getCell(r, 12).font = { bold: true }
        sheet.getCell(r, 13).font = { bold: true }

        const buffer = await wb.xlsx.writeBuffer()
        const safeBranchCode = (branch.code ?? branch.id).replace(/[^a-zA-Z0-9_-]/g, "_")
        const ts = `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())}_${pad(generatedAt.getHours())}-${pad(generatedAt.getMinutes())}-${pad(generatedAt.getSeconds())}`
        const filename = `branch_salary_details_${safeBranchCode}_${monthLabel}_${ts}.xlsx`

        return new NextResponse(buffer as ArrayBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (error) {
        console.error("Error exporting branch salary:", error)
        return internalServerError("Failed to export branch salary.")
    }
}
