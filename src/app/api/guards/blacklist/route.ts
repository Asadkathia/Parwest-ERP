import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

function sanitizeCnic(value: string) {
    return value.trim()
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const { searchParams } = new URL(request.url)
        const cnicQuery = sanitizeCnic(searchParams.get("cnic") || "")

        const blacklistRows = await prisma.blacklistedCnic.findMany({
            where: cnicQuery ? { cnic: { contains: cnicQuery, mode: "insensitive" } } : undefined,
            orderBy: { updatedAt: "desc" },
            take: 200,
        })

        const cnicList = blacklistRows.map((row) => row.cnic)
        const guards = cnicList.length
            ? await prisma.guard.findMany({
                  where: { cnic: { in: cnicList } },
                  select: { id: true, name: true, cnic: true, updatedAt: true },
              })
            : []
        const guardByCnic = new Map(guards.map((guard) => [guard.cnic, guard]))

        const rows = blacklistRows.map((row) => {
            const match = guardByCnic.get(row.cnic)
            return {
                id: row.id,
                cnic: row.cnic,
                name: match?.name || "CNIC Blocked",
                updatedAt: row.updatedAt,
                reason: row.reason || null,
                blacklistedBy: row.createdByName || "System",
            }
        })

        return NextResponse.json(rows)
    } catch (error: unknown) {
        if (isPrismaMissingSchemaError(error)) {
            const guards = await prisma.guard.findMany({
                where: { status: "BLACKLISTED" },
                orderBy: { updatedAt: "desc" },
                select: { id: true, name: true, cnic: true, updatedAt: true },
                take: 200,
            })
            return NextResponse.json(guards)
        }
        console.error("Error fetching blacklisted guards:", error)
        return internalServerError("Failed to fetch blacklisted guards")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const body = await request.json()
        const cnic = sanitizeCnic(typeof body.cnic === "string" ? body.cnic : "")
        const reason = typeof body.reason === "string" ? body.reason.trim() : null
        if (!cnic) {
            return badRequest("cnic is required")
        }

        if (!/^\d{5}-\d{7}-\d$/.test(cnic)) {
            return badRequest("CNIC format must be XXXXX-XXXXXXX-X.")
        }

        const blacklistEntry = await prisma.blacklistedCnic.upsert({
            where: { cnic },
            update: {
                reason,
                createdByUserId: session.user.id || null,
                createdByName: session.user.name || session.user.email || "System",
            },
            create: {
                cnic,
                reason,
                createdByUserId: session.user.id || null,
                createdByName: session.user.name || session.user.email || "System",
            },
        })

        await prisma.guard.updateMany({
            where: { cnic },
            data: { status: "BLACKLISTED" },
        })

        return NextResponse.json(
            {
                id: blacklistEntry.id,
                cnic: blacklistEntry.cnic,
                status: "BLACKLISTED",
                reason: blacklistEntry.reason || null,
            },
            { status: 200 }
        )
    } catch (error: unknown) {
        console.error("Error blacklisting CNIC:", error)
        return internalServerError("Failed to blacklist CNIC")
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const body = await request.json().catch(() => ({}))
        const id = typeof body.id === "string" ? body.id.trim() : ""
        const cnic = sanitizeCnic(typeof body.cnic === "string" ? body.cnic : "")

        if (!id && !cnic) {
            return badRequest("id or cnic is required")
        }

        const record = id
            ? await prisma.blacklistedCnic.findUnique({ where: { id } })
            : await prisma.blacklistedCnic.findUnique({ where: { cnic } })

        if (!record) {
            return notFound("Blacklist record not found.")
        }

        await prisma.blacklistedCnic.delete({ where: { id: record.id } })
        await prisma.guard.updateMany({
            where: { cnic: record.cnic, status: "BLACKLISTED" },
            data: { status: "ACTIVE" },
        })

        return NextResponse.json({ success: true, cnic: record.cnic })
    } catch (error: unknown) {
        console.error("Error removing blacklisted CNIC:", error)
        return internalServerError("Failed to remove blacklisted CNIC")
    }
}
