import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"

const DEFAULT_TYPES = ["Guard", "Supervisor", "CPO", "Armed Guard", "Unarmed Guard"]

async function ensureDefaults() {
  try {
    const count = await (prisma.guardDesignationType as unknown as { count: () => Promise<number> }).count()
    if (count === 0) {
      for (let i = 0; i < DEFAULT_TYPES.length; i++) {
        await (prisma.guardDesignationType as unknown as {
          upsert: (args: unknown) => Promise<unknown>
        }).upsert({
          where: { name: DEFAULT_TYPES[i] },
          update: {},
          create: { name: DEFAULT_TYPES[i], isActive: true, sortOrder: i + 1 },
        })
      }
    }
  } catch { /* ignore if table not yet migrated */ }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDefaults()
    const activeOnly = request.nextUrl.searchParams.get("activeOnly") !== "false"
    const types = await (prisma.guardDesignationType as unknown as {
      findMany: (args: unknown) => Promise<unknown[]>
    }).findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    return NextResponse.json(types)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const body = await request.json()
    const name = String(body?.name || "").trim()
    if (!name) return badRequest("Name is required.")

    const type = await (prisma.guardDesignationType as unknown as {
      create: (args: unknown) => Promise<unknown>
    }).create({
      data: { name, isActive: true, sortOrder: body.sortOrder ?? 0 },
    })
    return NextResponse.json(type, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("Unique constraint")) return badRequest("A designation with this name already exists.")
    return internalServerError("Failed to create designation type.")
  }
}