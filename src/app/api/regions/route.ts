import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, conflict, internalServerError, unauthorized, forbidden } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope } from "@/lib/access/scope"
import { PROVINCE_VALUES, type ProvinceValue } from "@/lib/geo/province-constants"

/** Validate an optional province against the Province enum. Returns the canonical
 *  value, `undefined` when absent/blank, or `"INVALID"` for a non-empty bad value. */
function parseProvince(raw: unknown): ProvinceValue | undefined | "INVALID" {
    if (raw == null || String(raw).trim() === "") return undefined
    const p = String(raw).trim().toUpperCase()
    return (PROVINCE_VALUES as readonly string[]).includes(p) ? (p as ProvinceValue) : "INVALID"
}

// GET is intentionally open to any authenticated user — regions drive the
// global topbar picker and are not sensitive. Regional users still only see
// their assigned region thanks to `deriveManagerScope` filtering below.

export async function GET() {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const scope = deriveManagerScope(session)

        const regions = await prisma.region.findMany({
            where: scope?.regionId ? { id: scope.regionId } : undefined,
            orderBy: { name: "asc" },
        })
        return NextResponse.json(regions, { status: 200 })
    } catch (error: unknown) {
        console.error("Error fetching regions:", error)
        return internalServerError("Failed to fetch regions")
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
        if (!name) {
            return badRequest("Region name is required.")
        }

        // Province is the geo anchor for branches in this region — `provinceForBranch`
        // derives a branch's province from `region.province`, and the #47 invariant
        // depends on it. Persist it (validated against the Province enum); the POST
        // previously dropped it, leaving API-created regions with a null province.
        const province = parseProvince(body?.province)
        if (province === "INVALID") {
            return badRequest(`province must be one of: ${PROVINCE_VALUES.join(", ")}.`)
        }

        const region = await prisma.region.create({
            data: {
                name,
                ...(province ? { province } : {}),
            },
        })

        return NextResponse.json(region, { status: 201 })
    } catch (error: unknown) {
        if (String((error as { code?: string }).code) === "P2002") {
            return conflict("Region already exists.")
        }
        console.error("Error creating region:", error)
        return internalServerError("Failed to create region")
    }
}
