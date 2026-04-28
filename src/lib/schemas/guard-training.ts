import { z } from "zod"

/**
 * Schema for the Guard On-Job Trainings tab "Add OJT session" dialog.
 *
 * The server route at `src/app/api/guards/[id]/trainings/route.ts` accepts a
 * minimal payload: `{ trainingType, completedAt, instructor, notes }`. The
 * tab UI captures richer per-session metadata (regional office, client,
 * branch, branch supervisor / manager, armorer flag, supervisor uniform
 * flag, remarks) and serialises it into the `notes` pipe-separated string.
 *
 * This client-side schema validates the dialog inputs before that
 * serialisation happens.
 */
export const guardTrainingCreateSchema = z.object({
    completedAt: z
        .string()
        .trim()
        .min(1, "Date is required"),
    regionalOfficeId: z.string().trim().optional().or(z.literal("")),
    regionalOfficeName: z.string().trim().optional().or(z.literal("")),
    clientId: z.string().trim().optional().or(z.literal("")),
    clientName: z.string().trim().optional().or(z.literal("")),
    branchId: z.string().trim().optional().or(z.literal("")),
    branchName: z.string().trim().optional().or(z.literal("")),
    branchSupervisor: z
        .string()
        .trim()
        .max(200, "Branch supervisor name is too long")
        .optional()
        .or(z.literal("")),
    branchManager: z
        .string()
        .trim()
        .max(200, "Branch manager name is too long")
        .optional()
        .or(z.literal("")),
    conductedBy: z
        .string()
        .trim()
        .max(200, "Conducted-by name is too long")
        .optional()
        .or(z.literal("")),
    remarks: z
        .string()
        .trim()
        .max(2000, "Remarks are too long")
        .optional()
        .or(z.literal("")),
    armorer: z.boolean(),
    supervisorWithUniform: z.boolean(),
})

export type GuardTrainingCreateInput = z.infer<typeof guardTrainingCreateSchema>
