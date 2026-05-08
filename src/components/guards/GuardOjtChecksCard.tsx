"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, GraduationCap, Minus } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"

type TrainingCategory = {
    id: string
    name: string
    sortOrder: number
}

type TrainingCheck = {
    categoryId: string
    completed: boolean
    completedAt: string | null
    category?: { id: string; name: string; sortOrder: number }
}

type Training = {
    id: string
    completedAt: string
    ojtChecks?: TrainingCheck[]
}

type CategoryStatus = {
    id: string
    name: string
    completed: boolean
    /** ISO date of the most recent completed check for this category. */
    lastCompletedAt: string | null
}

interface Props {
    guardId: string
}

/**
 * Shows the guard's OJT training-check completion grid on the profile.
 * Aggregates `ojtChecks` across every training session — for each active
 * category, surfaces "completed" iff at least one session marked it complete,
 * with the most recent completion date as a hover hint.
 *
 * Resolves ticket #30: "all OJT training checks should display against
 * guards listing and profile". The listing rollup lives in the guards
 * table; this card is the profile-side detail.
 */
export default function GuardOjtChecksCard({ guardId }: Props) {
    const [categories, setCategories] = useState<TrainingCategory[]>([])
    const [trainings, setTrainings] = useState<Training[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        async function load() {
            try {
                const [catsRes, trainingsRes] = await Promise.all([
                    fetch("/api/training-categories"),
                    fetch(`/api/guards/${guardId}/trainings`),
                ])
                const catsPayload: unknown = catsRes.ok ? await catsRes.json() : []
                const trainingsPayload: unknown = trainingsRes.ok ? await trainingsRes.json() : []

                if (cancelled) return

                const cats: TrainingCategory[] = Array.isArray(catsPayload)
                    ? (catsPayload as TrainingCategory[])
                    : Array.isArray((catsPayload as { data?: unknown })?.data)
                      ? ((catsPayload as { data: TrainingCategory[] }).data)
                      : []
                setCategories(cats.filter((c): c is TrainingCategory => Boolean(c?.id && c?.name)))
                setTrainings(Array.isArray(trainingsPayload) ? (trainingsPayload as Training[]) : [])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [guardId])

    const statuses = useMemo<CategoryStatus[]>(() => {
        const lastByCategory = new Map<string, string>() // categoryId -> latest completedAt ISO
        for (const t of trainings) {
            for (const c of t.ojtChecks ?? []) {
                if (!c.completed) continue
                const at = c.completedAt ?? t.completedAt
                if (!at) continue
                const prev = lastByCategory.get(c.categoryId)
                if (!prev || new Date(at).getTime() > new Date(prev).getTime()) {
                    lastByCategory.set(c.categoryId, at)
                }
            }
        }
        return [...categories]
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
            .map((cat) => ({
                id: cat.id,
                name: cat.name,
                completed: lastByCategory.has(cat.id),
                lastCompletedAt: lastByCategory.get(cat.id) ?? null,
            }))
    }, [categories, trainings])

    const doneCount = statuses.filter((s) => s.completed).length
    const total = statuses.length

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    OJT Training Checks
                </CardTitle>
                {!loading && total > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {doneCount}/{total} completed
                    </span>
                )}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading training checks...</p>
                ) : total === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                        No training categories configured. Ask an admin to set them up under Settings → Training Categories.
                    </p>
                ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {statuses.map((s) => (
                            <li key={s.id} className="flex items-center gap-2 text-sm">
                                {s.completed ? (
                                    <Check className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                                ) : (
                                    <Minus className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                                )}
                                <span className={s.completed ? "text-foreground" : "text-muted-foreground"}>
                                    {s.name}
                                </span>
                                {s.completed && s.lastCompletedAt && (
                                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                        {new Date(s.lastCompletedAt).toLocaleDateString("en-US", {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    )
}
