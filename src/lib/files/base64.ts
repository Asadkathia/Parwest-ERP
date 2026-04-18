/**
 * Size-limited file → base64 data URL utility.
 *
 * - Max 500KB base64 (~375KB original), matching guard photo pattern.
 * - Rejects files that exceed the cap rather than silently truncating.
 * - Returns a full data URL: `data:<mime>;base64,<payload>` — suitable for
 *   direct <img src=...> usage or DB storage.
 */

export const MAX_BASE64_BYTES = 500 * 1024
export const MAX_ORIGINAL_BYTES = Math.floor(MAX_BASE64_BYTES * 0.75)

export type FileToBase64Result =
  | { ok: true; dataUrl: string; mime: string; byteLength: number }
  | { ok: false; error: string }

export async function fileToBase64(file: File): Promise<FileToBase64Result> {
  if (file.size > MAX_ORIGINAL_BYTES) {
    return {
      ok: false,
      error: `File exceeds ${Math.round(MAX_ORIGINAL_BYTES / 1024)}KB limit.`,
    }
  }

  const dataUrl = await new Promise<string | null>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Failed to read file."))
    reader.onload = () => {
      const result = reader.result
      resolve(typeof result === "string" ? result : null)
    }
    reader.readAsDataURL(file)
  }).catch(() => null)

  if (!dataUrl) return { ok: false, error: "Could not read file contents." }

  if (dataUrl.length > MAX_BASE64_BYTES) {
    return {
      ok: false,
      error: `Encoded file exceeds ${Math.round(MAX_BASE64_BYTES / 1024)}KB limit. Choose a smaller file.`,
    }
  }

  return {
    ok: true,
    dataUrl,
    mime: file.type || "application/octet-stream",
    byteLength: dataUrl.length,
  }
}

export function isBase64DataUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && /^data:[^;]+;base64,/.test(value)
}

export function base64ByteLength(dataUrl: string): number {
  const payload = dataUrl.split(",")[1] ?? ""
  return Math.floor((payload.length * 3) / 4)
}
