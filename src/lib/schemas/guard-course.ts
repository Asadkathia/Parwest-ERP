import { z } from "zod"

/**
 * Schema for the Guard Refresher Courses tab "Add course" dialog.
 *
 * Mirrors the POST body accepted by:
 *   src/app/api/guards/[id]/courses/route.ts
 *
 * Note: file uploads (`fileName` / `fileData`) are NOT validated here — the
 * existing legacy upload widget handles file→base64 capture and is preserved
 * during the reskin. The values are sent through alongside the form payload.
 */
export const guardCourseCreateSchema = z.object({
    courseName: z
        .string()
        .trim()
        .min(1, "Course name is required")
        .max(200, "Course name is too long"),
    courseLevel: z
        .string()
        .trim()
        .min(1, "Course level is required")
        .max(100, "Course level is too long"),
    instructor: z
        .string()
        .trim()
        .min(1, "Course instructor is required")
        .max(200, "Instructor name is too long"),
    location: z
        .string()
        .trim()
        .min(1, "Course location is required")
        .max(200, "Location is too long"),
    issueDate: z
        .string()
        .trim()
        .optional()
        .or(z.literal("")),
    description: z
        .string()
        .trim()
        .max(2000, "Description is too long")
        .optional()
        .or(z.literal("")),
})

export type GuardCourseCreateInput = z.infer<typeof guardCourseCreateSchema>
