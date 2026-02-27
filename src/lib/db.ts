import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { isMockEnabled } from '@/lib/mockData'
import { createMockPrismaClient } from '@/lib/mockData/prismaMock'

const mockMode = isMockEnabled()
const databaseUrl =
    process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

if (!mockMode && !databaseUrl) {
    throw new Error(
        "Database URL is required when mock mode is disabled. Set DATABASE_URL."
    )
}

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

export const prisma =
    globalForPrisma.prisma ??
    (mockMode
        ? (createMockPrismaClient() as unknown as PrismaClient)
        : new PrismaClient({
            adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })),
            log: ['query'],
        }))

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
