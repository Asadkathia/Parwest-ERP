import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const databaseUrl =
    process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

if (!databaseUrl) {
    throw new Error(
        "Database URL is required. Set DATABASE_URL (or DATABASE_URL_UNPOOLED)."
    )
}

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })),
        log: ['query'],
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
