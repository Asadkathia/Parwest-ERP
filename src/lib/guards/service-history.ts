import { prisma } from "@/lib/db"

export type ServiceHistoryEvent =
    | "ENROLLED"
    | "STATUS_CHANGED"
    | "BLACKLISTED"
    | "UNBLACKLISTED"
    | "REACTIVATED"

export interface RecordServiceEventInput {
    cnic: string
    guardId?: string | null
    parwestId?: string | null
    guardName?: string | null
    event: ServiceHistoryEvent
    fromStatus?: string | null
    toStatus?: string | null
    description?: string | null
    changedByName?: string | null
    regionName?: string | null
    officeName?: string | null
}

/**
 * Records a guard service history event keyed by CNIC.
 * Fire-and-forget safe: failures are logged but never thrown.
 */
export async function recordGuardServiceEvent(input: RecordServiceEventInput): Promise<void> {
    try {
        await prisma.guardServiceHistory.create({
            data: {
                cnic: input.cnic,
                guardId: input.guardId ?? null,
                parwestId: input.parwestId ?? null,
                guardName: input.guardName ?? null,
                event: input.event,
                fromStatus: input.fromStatus ?? null,
                toStatus: input.toStatus ?? null,
                description: input.description ?? null,
                changedByName: input.changedByName ?? null,
                regionName: input.regionName ?? null,
                officeName: input.officeName ?? null,
            },
        })
    } catch (err) {
        console.error("[service-history] Failed to record event:", err)
    }
}