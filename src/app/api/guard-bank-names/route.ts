import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

const DEFAULT_BANK_NAMES = [
  "HBL", "MCB", "UBL", "Allied Bank", "Bank Alfalah", "Meezan Bank",
  "National Bank", "Standard Chartered", "Askari Bank", "Faysal Bank",
  "Bank Al-Habib", "Dubai Islamic Bank", "Silk Bank", "Soneri Bank",
]

async function ensureDefaults() {
  try {
    const count = await (prisma.guardBankName as unknown as { count: () => Promise<number> }).count()
    if (count === 0) {
      for (let i = 0; i < DEFAULT_BANK_NAMES.length; i++) {
        await (prisma.guardBankName as unknown as {
          upsert: (args: unknown) => Promise<unknown>
        }).upsert({
          where: { name: DEFAULT_BANK_NAMES[i] },
          update: {},
          create: { name: DEFAULT_BANK_NAMES[i], isActive: true, sortOrder: i + 1 },
        })
      }
    }
  } catch { /* ignore if table not yet migrated */ }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "VIEW")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })
    await ensureDefaults()
    const activeOnly = request.nextUrl.searchParams.get("activeOnly") !== "false"
    const banks = await (prisma.guardBankName as unknown as {
      findMany: (args: unknown) => Promise<unknown[]>
    }).findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    return NextResponse.json(banks)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "CREATE")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const body = await request.json()
    const name = String(body?.name || "").trim()
    if (!name) return badRequest("Name is required.")

    const bank = await (prisma.guardBankName as unknown as {
      create: (args: unknown) => Promise<unknown>
    }).create({
      data: { name, isActive: true, sortOrder: body.sortOrder ?? 0 },
    })
    return NextResponse.json(bank, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("Unique constraint")) return badRequest("A bank with this name already exists.")
    return internalServerError("Failed to create bank name.")
  }
}
