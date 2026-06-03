import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, conflict, internalServerError, unauthorized, forbidden } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, buildManagerScopeWhere, managerScopeDenied } from "@/lib/access/scope"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "SETTINGS", "VIEW")) return forbidden()

        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId") || undefined

        const scope = deriveManagerScope(session)
        // Reject cross-scope URL requests outright (e.g. a regional user passing
        // ?regionId= for a different region). Without this, the request would
        // silently fall back to the user's own region — confusing for clients.
        if (managerScopeDenied(scope, { regionId: regionId ?? null })) {
            return forbidden("Forbidden: requested region is outside your assigned scope.")
        }
        const scopeWhere = buildManagerScopeWhere(scope, { regionId: "regionId", regionalOfficeId: "id" })

        const regionalOffices = await prisma.regionalOffice.findMany({
            where: {
                ...(regionId ? { regionId } : {}),
                ...scopeWhere,
            },
            include: { region: true },
            orderBy: { name: "asc" },
        })
        return NextResponse.json(regionalOffices, { status: 200 })
    } catch (error: unknown) {
        console.error("Error fetching regional offices:", error)
        return internalServerError("Failed to fetch regional offices")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "SETTINGS", "CREATE")) return forbidden()

        const body = await request.json()
        const name = String(body?.name || "").trim()
        const seriesCode = String(body?.seriesCode || "").trim().toUpperCase()
        const regionId = String(body?.regionId || "").trim()
        const officeHead = body?.officeHead ? String(body.officeHead) : null
        const phone = body?.phone ? String(body.phone) : null
        const mobile = body?.mobile ? String(body.mobile) : null
        const fax = body?.fax ? String(body.fax) : null
        const latitude = body?.latitude != null && body.latitude !== "" ? parseFloat(String(body.latitude)) : null
        const longitude = body?.longitude != null && body.longitude !== "" ? parseFloat(String(body.longitude)) : null

        // Reserve % override — null/blank or decimal in [0,1]
        let reservePct: number | null = null
        if (body?.reservePct != null && body.reservePct !== "") {
            const num = typeof body.reservePct === "number" ? body.reservePct : parseFloat(String(body.reservePct))
            if (Number.isNaN(num) || num < 0 || num > 1) {
                return badRequest("reservePct must be a decimal between 0 and 1.")
            }
            reservePct = num
        }

        if (!name || !seriesCode || !regionId) {
            return badRequest("name, seriesCode and regionId are required.")
        }
        if (latitude != null && (isNaN(latitude) || latitude < -90 || latitude > 90)) {
            return badRequest("Latitude must be between -90 and 90.")
        }
        if (longitude != null && (isNaN(longitude) || longitude < -180 || longitude > 180)) {
            return badRequest("Longitude must be between -180 and 180.")
        }

        const regionalOffice = await prisma.regionalOffice.create({
            data: {
                name,
                seriesCode,
                regionId,
                officeHead,
                phone,
                mobile,
                fax,
                ...(latitude != null ? { latitude } : {}),
                ...(longitude != null ? { longitude } : {}),
                ...(reservePct != null ? { reservePct } : {}),
            },
            include: {
                region: true,
            },
        })

        return NextResponse.json(regionalOffice, { status: 201 })
    } catch (error: unknown) {
        if (String((error as { code?: string }).code) === "P2002") {
            return conflict("Office name/series code already exists.")
        }
        if (String((error as { code?: string }).code) === "P2003") {
            return badRequest("Invalid region selected.")
        }
        console.error("Error creating regional office:", error)
        return internalServerError("Failed to create regional office")
    }
}
