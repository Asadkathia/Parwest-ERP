"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, X, Loader2, Trash2, Download, BookOpen } from "lucide-react"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

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
  courses: GuardLooseRow[]
  guardId: string
}

function formatDate(val: string | null | undefined) {
  if (!val) return "—"
  const d = new Date(val)
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })
}

const EMPTY_FORM = {
  courseName: "",
  courseLevel: "",
  instructor: "",
  location: "",
  issueDate: "",
  description: "",
  fileName: "",
  fileData: "",
}

export default function CoursesTab({ guardId }: CoursesTabProps) {
  const [records, setRecords] = useState<GuardCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchCourses = useCallback(() => {
    if (!guardId) return
    setLoading(true)
    fetch(`/api/guards/${guardId}/courses`)
      .then(r => r.json())
      .then(data => { setRecords(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setRecords([]); setLoading(false) })
  }, [guardId])

  useEffect(() => { fetchCourses() }, [fetchCourses])

  function openModal() {
    setForm(EMPTY_FORM)
    setError("")
    setShowModal(true)
    if (fileRef.current) fileRef.current.value = ""
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setForm(prev => ({
        ...prev,
        fileName: file.name,
        fileData: (ev.target?.result as string) || "",
      }))
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setForm(prev => ({
        ...prev,
        fileName: file.name,
        fileData: (ev.target?.result as string) || "",
      }))
    }
    reader.readAsDataURL(file)
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setError("")
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleSubmit() {
    setError("")
    if (!form.courseName.trim()) { setError("Course name is required."); return }
    if (!form.courseLevel.trim()) { setError("Course level is required."); return }
    if (!form.instructor.trim()) { setError("Course instructor is required."); return }
    if (!form.location.trim()) { setError("Course location is required."); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/guards/${guardId}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: form.courseName.trim(),
          courseLevel: form.courseLevel.trim(),
          instructor: form.instructor.trim(),
          location: form.location.trim(),
          issueDate: form.issueDate || null,
          description: form.description.trim() || null,
          fileName: form.fileName || null,
          fileData: form.fileData || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string })?.error || "Failed to save course.")
      } else {
        setShowModal(false)
        fetchCourses()
      }
    } catch { setError("Network error.") }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this course record?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/guards/${guardId}/courses/${id}`, { method: "DELETE" })
      if (res.ok) fetchCourses()
    } catch { /* ignore */ }
    setDeletingId(null)
  }

  function downloadFile(course: GuardCourse) {
    if (!course.fileData || !course.fileName) return
    const a = document.createElement("a")
    a.href = course.fileData
    a.download = course.fileName
    a.click()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text)] uppercase tracking-wide">Refresher Courses</h2>
        <button
          onClick={openModal}
          className="ui-btn ui-btn-primary flex items-center justify-center w-9 h-9 p-0 rounded"
          title="Add New Course"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1a2942] text-white text-xs uppercase">
                <th className="px-4 py-3 text-left">Course Name</th>
                <th className="px-4 py-3 text-left">Course Level</th>
                <th className="px-4 py-3 text-left">Instructor</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Issue Date</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">File</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[var(--text-muted)]">
                    <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    NO RECORD FOUND
                  </td>
                </tr>
              ) : records.map(course => (
                <tr key={course.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]/40 transition-colors">
                  <td className="px-4 py-3 font-medium">{course.courseName}</td>
                  <td className="px-4 py-3">{course.courseLevel}</td>
                  <td className="px-4 py-3">{course.instructor}</td>
                  <td className="px-4 py-3">{course.location}</td>
                  <td className="px-4 py-3">{formatDate(course.issueDate)}</td>
                  <td className="px-4 py-3 max-w-[180px] truncate text-[var(--text-muted)]">{course.description || "—"}</td>
                  <td className="px-4 py-3">
                    {course.fileData && course.fileName ? (
                      <button
                        onClick={() => downloadFile(course)}
                        className="flex items-center gap-1 text-xs text-[var(--brand)] hover:underline"
                        title={course.fileName}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="max-w-[80px] truncate">{course.fileName}</span>
                      </button>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(course.id)}
                      disabled={deletingId === course.id}
                      className="p-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200"
                      title="Delete"
                    >
                      {deletingId === course.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Course Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h3 className="text-sm font-semibold text-[var(--text)] uppercase tracking-widest">
                Add New Refresher Course
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1">
              {/* Row 1: Course Name + Course Level */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">
                    Course Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="ui-input"
                    placeholder="Course Name"
                    value={form.courseName}
                    onChange={e => setField("courseName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">
                    Course Level <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="ui-input"
                    placeholder="Course Name"
                    value={form.courseLevel}
                    onChange={e => setField("courseLevel", e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Instructor + Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">
                    Course Instructor <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="ui-input"
                    placeholder="Course Instructor"
                    value={form.instructor}
                    onChange={e => setField("instructor", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">
                    Course Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="ui-input"
                    placeholder="Course Location"
                    value={form.location}
                    onChange={e => setField("location", e.target.value)}
                  />
                </div>
              </div>

              {/* Row 3: Issue Date + Description */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    className="ui-input"
                    placeholder="ISSUE DATE"
                    value={form.issueDate}
                    onChange={e => setField("issueDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">
                    Description
                  </label>
                  <input
                    className="ui-input"
                    placeholder="Description"
                    value={form.description}
                    onChange={e => setField("description", e.target.value)}
                  />
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">
                  Upload File
                </label>
                <div
                  className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--brand)] hover:bg-[var(--bg-muted)]/30 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  {form.fileName ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-[var(--brand)]">
                      <Download className="h-4 w-4" />
                      <span className="font-medium">{form.fileName}</span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setForm(prev => ({ ...prev, fileName: "", fileData: "" })); if (fileRef.current) fileRef.current.value = "" }}
                        className="ml-1 text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">DROP FILES HERE TO UPLOAD</p>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl shrink-0">
              <button
                type="button"
                onClick={resetForm}
                className="ui-btn px-5 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded"
              >
                RESET
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="ui-btn ui-btn-primary px-5 py-2 text-sm flex items-center gap-2"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                SUBMIT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
