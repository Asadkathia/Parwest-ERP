import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, conflict, internalServerError, unauthorized } from "@/lib/api/response"

// Default types seeded on first fetch if table is empty
const DEFAULT_TYPES = [
    { name: "BANK", label: "Bank" },
    { name: "MANUFACTURER", label: "Manufacturer" },
    { name: "OTHER", label: "Other" },
]

export async function GET() {
    try {
        let types = await prisma.clientType.findMany({ orderBy: { label: "asc" } })

        // Auto-seed defaults if no types exist yet
        if (types.length === 0) {
            await prisma.clientType.createMany({ data: DEFAULT_TYPES, skipDuplicates: true })
            types = await prisma.clientType.findMany({ orderBy: { label: "asc" } })
        }

        return NextResponse.json(types)
    } catch (error) {
        console.error("Error fetching client types:", error)
        return internalServerError("Failed to fetch client types")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const body = await request.json()
        const label = String(body?.label || "").trim()
        if (!label) return badRequest("Label is required.")

        // Derive a name: upper-snake from label e.g. "Security Firm" → "SECURITY_FIRM"
        const name = label.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "")
        if (!name) return badRequest("Invalid label — could not derive a type name.")

        const clientType = await prisma.clientType.create({ data: { name, label } })
        return NextResponse.json(clientType, { status: 201 })
    } catch (error) {
        if (String((error as { code?: string }).code) === "P2002") {
            return conflict("A client type with this name already exists.")
        }
        console.error("Error creating client type:", error)
        return internalServerError("Failed to create client type")
    }
}
