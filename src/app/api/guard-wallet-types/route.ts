import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"

const DEFAULT_WALLET_TYPES = ["JazzCash", "EasyPaisa", "NayaPay", "SadaPay", "UPaisa"]

async function ensureDefaults() {
  try {
    const count = await (prisma.guardWalletType as unknown as { count: () => Promise<number> }).count()
    if (count === 0) {
      for (let i = 0; i < DEFAULT_WALLET_TYPES.length; i++) {
        await (prisma.guardWalletType as unknown as {
          upsert: (args: unknown) => Promise<unknown>
        }).upsert({
          where: { name: DEFAULT_WALLET_TYPES[i] },
          update: {},
          create: { name: DEFAULT_WALLET_TYPES[i], isActive: true, sortOrder: i + 1 },
        })
      }
    }
  } catch { /* ignore if table not yet migrated */ }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDefaults()
    const activeOnly = request.nextUrl.searchParams.get("activeOnly") !== "false"
    const wallets = await (prisma.guardWalletType as unknown as {
      findMany: (args: unknown) => Promise<unknown[]>
    }).findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    return NextResponse.json(wallets)
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

    const wallet = await (prisma.guardWalletType as unknown as {
      create: (args: unknown) => Promise<unknown>
    }).create({
      data: { name, isActive: true, sortOrder: body.sortOrder ?? 0 },
    })
    return NextResponse.json(wallet, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("Unique constraint")) return badRequest("A wallet type with this name already exists.")
    return internalServerError("Failed to create wallet type.")
  }
}
