"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { format } from "date-fns"
import {
    BookOpen,
    CalendarIcon,
    Download,
    Plus,
    Trash2,
    Upload,
    X,
} from "lucide-react"

import type { GuardLooseRow } from "@/components/guards/tabs/types"
import { Button } from "@/components/shadcn/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/shadcn/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/shadcn/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/shadcn/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/shadcn/alert-dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/shadcn/form"
import { Input } from "@/components/shadcn/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/shadcn/popover"
import { Calendar } from "@/components/shadcn/calendar"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import { cn } from "@/lib/utils"
import {
    guardCourseCreateSchema,
    type GuardCourseCreateInput,
} from "@/lib/schemas/guard-course"

type GuardCourse = {
    id: string
    courseName: string
    courseLevel: string
    instructor: string
    location: string
    issueDate: string | null
    description: string | null
    fileName: string | null
    fileData: string | null
    createdAt: string
    createdBy: { id: string; name: string } | null
}

interface CoursesTabProps {
    /** Server-rendered initial rows; the tab refetches on mount via the API. */
    courses?: GuardLooseRow[]
    guardId: string
    canCreate?: boolean
    canDelete?: boolean
}

function formatDate(val: string | null | undefined) {
    if (!val) return "—"
    const d = new Date(val)
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })
}

/** Read a JSON error envelope and return its `message` field. */
async function readErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const data = (await res.json()) as { message?: unknown }
        if (data && typeof data.message === "string" && data.message.length > 0) {
            return data.message
        }
    } catch {
        /* ignore */
    }
    return fallback
}

const EMPTY_FORM: GuardCourseCreateInput = {
    courseName: "",
    courseLevel: "",
    instructor: "",
    location: "",
    issueDate: "",
    description: "",
}

export default function CoursesTab({
    guardId,
    canCreate = false,
    canDelete = false,
}: CoursesTabProps) {
    const [records, setRecords] = useState<GuardCourse[]>([])
    const [loading, setLoading] = useState(true)
    const [showDialog, setShowDialog] = useState(false)
    const [saving, setSaving] = useState(false)

    // File upload (legacy widget — preserved during reskin)
    const fileRef = useRef<HTMLInputElement>(null)
    const [fileName, setFileName] = useState<string>("")
    const [fileData, setFileData] = useState<string>("")

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<GuardCourse | null>(null)
    const [deleting, setDeleting] = useState(false)

    const form = useForm<GuardCourseCreateInput>({
        resolver: zodResolver(guardCourseCreateSchema),
        defaultValues: EMPTY_FORM,
    })

    const fetchCourses = useCallback(async () => {
        if (!guardId) return
        setLoading(true)
        try {
            const res = await fetch(`/api/guards/${guardId}/courses`)
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to load courses")
                toast.error(msg)
                setRecords([])
                return
            }
            const data = await res.json()
            setRecords(Array.isArray(data) ? (data as GuardCourse[]) : [])
        } catch {
            toast.error("Failed to load courses")
            setRecords([])
        } finally {
            setLoading(false)
        }
    }, [guardId])

    useEffect(() => {
        void fetchCourses()
    }, [fetchCourses])

    const openDialog = () => {
        form.reset(EMPTY_FORM)
        setFileName("")
        setFileData("")
        if (fileRef.current) fileRef.current.value = ""
        setShowDialog(true)
    }

    const closeDialog = () => {
        setShowDialog(false)
        form.reset(EMPTY_FORM)
        setFileName("")
        setFileData("")
        if (fileRef.current) fileRef.current.value = ""
    }

    // ── Legacy file upload widget (preserved) ──────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            setFileName(file.name)
            setFileData((ev.target?.result as string) || "")
        }
        reader.readAsDataURL(file)
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            setFileName(file.name)
            setFileData((ev.target?.result as string) || "")
        }
        reader.readAsDataURL(file)
    }

    const clearFile = () => {
        setFileName("")
        setFileData("")
        if (fileRef.current) fileRef.current.value = ""
    }

    // ── Submit (POST) ─────────────────────────────────────────────────────
    const handleSubmit = form.handleSubmit(async (values) => {
        setSaving(true)
        try {
            const res = await fetch(`/api/guards/${guardId}/courses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    courseName: values.courseName.trim(),
                    courseLevel: values.courseLevel.trim(),
                    instructor: values.instructor.trim(),
                    location: values.location.trim(),
                    issueDate: values.issueDate || null,
                    description: values.description?.trim() || null,
                    fileName: fileName || null,
                    fileData: fileData || null,
                }),
            })
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to save course")
                toast.error(msg)
                return
            }
            toast.success("Course added")
            closeDialog()
            await fetchCourses()
        } catch {
            toast.error("Failed to save course")
        } finally {
            setSaving(false)
        }
    })

    // ── Delete (DELETE) ───────────────────────────────────────────────────
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        try {
            const res = await fetch(
                `/api/guards/${guardId}/courses/${deleteTarget.id}`,
                { method: "DELETE" }
            )
            if (!res.ok) {
                const msg = await readErrorMessage(res, "Failed to delete course")
                toast.error(msg)
                return
            }
            toast.success("Course deleted")
            setDeleteTarget(null)
            await fetchCourses()
        } catch {
            toast.error("Failed to delete course")
        } finally {
            setDeleting(false)
        }
    }

    const downloadFile = (course: GuardCourse) => {
        if (!course.fileData || !course.fileName) return
        const a = document.createElement("a")
        a.href = course.fileData
        a.download = course.fileName
        a.click()
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-12 text-center text-sm text-muted-foreground">
                    Loading courses…
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle>Refresher Courses</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {records.length} {records.length === 1 ? "course" : "courses"} on file
                        </p>
                    </div>
                    {canCreate && (
                        <PermissionGate module="GUARDS" action="CREATE" mode="hide">
                            <Button type="button" size="sm" onClick={openDialog}>
                                <Plus className="mr-1 h-4 w-4" />
                                Add Course
                            </Button>
                        </PermissionGate>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    {records.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
                            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                            <span>No refresher courses recorded yet.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Course Name</TableHead>
                                        <TableHead>Level</TableHead>
                                        <TableHead>Instructor</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Issue Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>File</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {records.map((course) => (
                                        <TableRow key={course.id}>
                                            <TableCell className="font-medium">
                                                {course.courseName}
                                            </TableCell>
                                            <TableCell>{course.courseLevel}</TableCell>
                                            <TableCell>{course.instructor}</TableCell>
                                            <TableCell>{course.location}</TableCell>
                                            <TableCell className="tabular-nums">
                                                {formatDate(course.issueDate)}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                                                {course.description || "—"}
                                            </TableCell>
                                            <TableCell>
                                                {course.fileData && course.fileName ? (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => downloadFile(course)}
                                                        title={course.fileName}
                                                        className="h-7 px-2"
                                                    >
                                                        <Download className="mr-1 h-3.5 w-3.5" />
                                                        <span className="max-w-[100px] truncate text-xs">
                                                            {course.fileName}
                                                        </span>
                                                    </Button>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {canDelete ? (
                                                    <PermissionGate
                                                        module="GUARDS"
                                                        action="DELETE"
                                                        mode="hide"
                                                    >
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setDeleteTarget(course)}
                                                            className="h-7 w-7 p-0 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:hover:bg-rose-950/30"
                                                            title="Delete course"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </PermissionGate>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Course Dialog */}
            <Dialog
                open={showDialog}
                onOpenChange={(open) => {
                    if (!open) closeDialog()
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add Refresher Course</DialogTitle>
                        <DialogDescription>
                            Record a refresher course completed by this guard.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="courseName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Course Name <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="Course name" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="courseLevel"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Course Level <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="Level" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="instructor"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Instructor <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="Course instructor" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="location"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Location <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="Course location" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="issueDate"
                                    render={({ field }) => {
                                        const dateValue = field.value
                                            ? new Date(field.value)
                                            : undefined
                                        const valid =
                                            dateValue && !Number.isNaN(dateValue.getTime())
                                        return (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Issue Date</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className={cn(
                                                                    "w-full justify-start text-left font-normal",
                                                                    !valid && "text-muted-foreground"
                                                                )}
                                                            >
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {valid
                                                                    ? format(dateValue, "PPP")
                                                                    : "Pick a date"}
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        className="w-auto p-0"
                                                        align="start"
                                                    >
                                                        <Calendar
                                                            mode="single"
                                                            selected={valid ? dateValue : undefined}
                                                            onSelect={(d) =>
                                                                field.onChange(
                                                                    d ? format(d, "yyyy-MM-dd") : ""
                                                                )
                                                            }
                                                            captionLayout="dropdown"
                                                            fromYear={1990}
                                                            toYear={new Date().getFullYear() + 1}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Description" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Legacy file upload widget — preserved */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Upload File</label>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input p-6 text-center text-sm text-muted-foreground hover:border-primary hover:bg-muted/40"
                                    onClick={() => fileRef.current?.click()}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault()
                                            fileRef.current?.click()
                                        }
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleDrop}
                                >
                                    {fileName ? (
                                        <div className="flex items-center gap-2 text-primary">
                                            <Download className="h-4 w-4" />
                                            <span className="font-medium">{fileName}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    clearFile()
                                                }}
                                                className="text-rose-500 hover:text-rose-700"
                                                aria-label="Remove file"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="h-5 w-5 text-muted-foreground/60" />
                                            <span>Drop a file here or click to upload</span>
                                        </>
                                    )}
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeDialog}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    {saving ? "Saving…" : "Save Course"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this course record?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="block">
                                <span className="font-medium text-foreground">
                                    {deleteTarget?.courseName ?? ""}
                                </span>{" "}
                                will be permanently removed from this guard&apos;s record. This
                                action cannot be undone.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
