/**
 * Shared upsert/clear helpers for per-guard EOBI / ESSI enrollment.
 */

import type { Prisma } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/db"

type DbClient = Prisma.TransactionClient | typeof defaultPrisma

export type EnrollmentInput = {
  isActive: boolean
  number?: string | null
  registrationDate?: Date | null
  notes?: string | null
}

export async function upsertEobiEnrollment(
  db: DbClient,
  guardId: string,
  input: EnrollmentInput
) {
  return db.eobiEnrollment.upsert({
    where: { guardId },
    create: {
      guardId,
      isActive: input.isActive,
      eobiNumber: input.number ?? null,
      registrationDate: input.registrationDate ?? null,
      notes: input.notes ?? null,
    },
    update: {
      isActive: input.isActive,
      eobiNumber: input.number ?? null,
      registrationDate: input.registrationDate ?? null,
      notes: input.notes ?? null,
    },
  })
}

export async function upsertEssiEnrollment(
  db: DbClient,
  guardId: string,
  input: EnrollmentInput
) {
  return db.essiEnrollment.upsert({
    where: { guardId },
    create: {
      guardId,
      isActive: input.isActive,
      essiNumber: input.number ?? null,
      registrationDate: input.registrationDate ?? null,
      notes: input.notes ?? null,
    },
    update: {
      isActive: input.isActive,
      essiNumber: input.number ?? null,
      registrationDate: input.registrationDate ?? null,
      notes: input.notes ?? null,
    },
  })
}
