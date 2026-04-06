import { prisma } from "@/lib/db"

export type StatusChangeType = "MANUAL" | "SYSTEM" | "BLACKLIST" | "ENROLLMENT"

export interface RecordStatusChangeInput {
    guardId: string
    cnic?: string | null
    parwestId?: string | null
    guardName?: string | null
    fromStatus?: string | null
    toStatus: string
    reason?: string | null
    changedByName?: string | null
    changedByType?: StatusChangeType
    regionName?: string | null
    officeName?: string | null
}

/**
 * Records a guard status history entry.
 * Fire-and-forget safe: failures are logged but never thrown.
 */
export async function recordGuardStatusChange(input: RecordStatusChangeInput): Promise<void> {
    try {
        await prisma.guardStatusHistory.create({
            data: {
                guardId: input.guardId,
                cnic: input.cnic ?? null,
                parwestId: input.parwestId ?? null,
                guardName: input.guardName ?? null,
                fromStatus: input.fromStatus ?? null,
                toStatus: input.toStatus,
                reason: input.reason ?? null,
                changedByName: input.changedByName ?? null,
                changedByType: input.changedByType ?? "MANUAL",
                regionName: input.regionName ?? null,
                officeName: input.officeName ?? null,
            },
        })
    } catch (err) {
        console.error("[status-history] Failed to record status change:", err)
    }
}