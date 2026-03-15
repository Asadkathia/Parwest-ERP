"use client"

import { useState, useRef } from "react"

interface PhoneInputProps {
    name: string
    required?: boolean
    placeholder?: string
    defaultValue?: string
    className?: string
}

const PREFIX = "+92-"
const MAX_DIGITS = 10  // 3 (network) + 7 (number)

function formatPhoneDigits(digits: string): string {
    const d = digits.slice(0, MAX_DIGITS)
    if (d.length <= 3) return PREFIX + d
    return `${PREFIX}${d.slice(0, 3)}-${d.slice(3)}`
}

export default function PhoneInput({
    name,
    required = false,
    placeholder = "+92-300-1234567",
    defaultValue,
    className = "ui-input",
}: PhoneInputProps) {
    const initDigits = defaultValue
        ? defaultValue.replace(/^\+92-?/, "").replace(/\D/g, "")
        : ""
    const [value, setValue] = useState(initDigits ? formatPhoneDigits(initDigits) : PREFIX)
    const [error, setError] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value

        // User deleted past the prefix — restore it
        if (!raw.startsWith(PREFIX)) {
            setValue(PREFIX)
            setError(false)
            return
        }

        // Extract only digits after the prefix
        const afterPrefix = raw.slice(PREFIX.length).replace(/\D/g, "")
        const formatted = formatPhoneDigits(afterPrefix)
        setValue(formatted)

        // Validate full number: +92-XXX-XXXXXXX
        const isComplete = /^\+92-\d{3}-\d{7}$/.test(formatted)
        setError(afterPrefix.length > 0 && !isComplete && afterPrefix.length === MAX_DIGITS)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const sel = inputRef.current?.selectionStart ?? value.length
        // Prevent deleting into the prefix
        if ((e.key === "Backspace" || e.key === "Delete") && sel <= PREFIX.length) {
            e.preventDefault()
        }
    }

    const handleFocus = () => {
        // Place cursor at end
        requestAnimationFrame(() => {
            const el = inputRef.current
            if (el) el.setSelectionRange(el.value.length, el.value.length)
        })
    }

    const isValid = /^\+92-\d{3}-\d{7}$/.test(value)

    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="tel"
                name={name}
                required={required}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                placeholder={placeholder}
                maxLength={16}  // +92-300-1234567 = 16 chars
                className={`${className} ${error ? "border-red-400 focus:ring-red-300" : ""} pr-8`}
                autoComplete="tel"
            />
            {/* Validity indicator */}
            {value.length > PREFIX.length && (
                <span
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs"
                    aria-hidden
                >
                    {isValid ? (
                        <span className="text-green-500">✓</span>
                    ) : (
                        <span className="text-gray-300">✗</span>
                    )}
                </span>
            )}
            {error && (
                <p className="mt-1 text-[11px] text-red-500">
                    Format must be +92-300-1234567
                </p>
            )}
        </div>
    )
}
