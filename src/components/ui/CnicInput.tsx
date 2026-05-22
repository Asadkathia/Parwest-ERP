"use client"

import { useEffect, useRef, useState } from "react"
import { CNIC_REGEX, formatCnicDigits } from "@/lib/validation/formats"

type Props = {
  name: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
  className?: string
  disabled?: boolean
  /** Async uniqueness check endpoint. Should return { exists: boolean, message?: string }. Receives ?cnic=XXXXX-XXXXXXX-X */
  uniqueCheckUrl?: string
  /** Exclude this guard id when checking uniqueness (for edit pages). */
  excludeGuardId?: string
}

export default function CnicInput({
  name,
  required = false,
  placeholder = "xxxxx-xxxxxxx-x",
  defaultValue,
  className = "ui-input",
  disabled = false,
  uniqueCheckUrl,
  excludeGuardId,
}: Props) {
  const [value, setValue] = useState(defaultValue ? formatCnicDigits(defaultValue) : "")
  const [touched, setTouched] = useState(false)
  const [asyncError, setAsyncError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const formatError = touched && value.length > 0 && !CNIC_REGEX.test(value)
  const showRequiredError = touched && required && value.length === 0
  const isValidFormat = CNIC_REGEX.test(value)
  const errorMsg = showRequiredError
    ? "CNIC is required"
    : formatError
      ? "Format must be XXXXX-XXXXXXX-X (13 digits)"
      : asyncError

  useEffect(() => {
    if (!uniqueCheckUrl || !isValidFormat) {
      setAsyncError(null)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setChecking(true)
      try {
        const url = new URL(uniqueCheckUrl, window.location.origin)
        url.searchParams.set("cnic", value)
        if (excludeGuardId) url.searchParams.set("excludeId", excludeGuardId)
        const res = await fetch(url.toString())
        if (!res.ok) {
          setAsyncError(null)
          return
        }
        const data = (await res.json()) as { exists?: boolean; blacklisted?: boolean; message?: string }
        if (data.blacklisted) setAsyncError(data.message || "This CNIC is blacklisted")
        else if (data.exists) setAsyncError(data.message || "A record with this CNIC already exists")
        else setAsyncError(null)
      } catch {
        setAsyncError(null)
      } finally {
        setChecking(false)
      }
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, isValidFormat, uniqueCheckUrl, excludeGuardId])

  const hasError = Boolean(errorMsg)

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        name={name}
        required={required}
        value={value}
        onChange={(e) => setValue(formatCnicDigits(e.target.value))}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        maxLength={15}
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        className={`${className} ${hasError ? "border-red-400 focus:ring-red-300" : ""} pr-8`}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : undefined}
      />
      {value.length > 0 && (
        <span
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs"
          aria-hidden
        >
          {checking ? (
            <span className="text-gray-400">…</span>
          ) : isValidFormat && !asyncError ? (
            <span className="text-green-500">✓</span>
          ) : (
            <span className="text-gray-300">✗</span>
          )}
        </span>
      )}
      {errorMsg && (
        <p id={`${name}-error`} className="mt-1 text-[11px] text-red-500">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
