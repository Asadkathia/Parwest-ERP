import { NextResponse } from "next/server"

export type ApiEnvelope<T = unknown> =
  | { success: true; data: T }
  | { success: false; message: string; code?: string }

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiEnvelope<T>>({ success: true, data }, { status })
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json<ApiEnvelope>({ success: false, message, code: "UNAUTHORIZED" }, { status: 401 })
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json<ApiEnvelope>({ success: false, message, code: "FORBIDDEN" }, { status: 403 })
}

export function badRequest(message = "Bad request") {
  return NextResponse.json<ApiEnvelope>({ success: false, message, code: "BAD_REQUEST" }, { status: 400 })
}

export function notFound(message = "Not found") {
  return NextResponse.json<ApiEnvelope>({ success: false, message, code: "NOT_FOUND" }, { status: 404 })
}

export function conflict(message = "Conflict") {
  return NextResponse.json<ApiEnvelope>({ success: false, message, code: "CONFLICT" }, { status: 409 })
}

export function internalServerError(message = "Internal server error") {
  return NextResponse.json<ApiEnvelope>({ success: false, message, code: "INTERNAL_ERROR" }, { status: 500 })
}

export function serviceUnavailable(message = "Service unavailable") {
  return NextResponse.json<ApiEnvelope>({ success: false, message, code: "SERVICE_UNAVAILABLE" }, { status: 503 })
}
