/**
 * Safe localStorage wrapper for guard profile image URL caching.
 *
 * Rules:
 * - Never stores raw base64 / data: URLs — they are 2–3 MB each and will blow
 *   the ~5 MB localStorage quota immediately. Only lightweight HTTP URLs are
 *   cached. (The DB is the source of truth for base64 payloads.)
 * - Wraps every write in try/catch; swallows QuotaExceededError gracefully.
 * - After a quota failure the module sets a session flag so no further writes
 *   are attempted in the same page load (prevents repeated error spam).
 * - Applies a TTL of 7 days and a max-entry cap of 20 keys to avoid unbounded
 *   growth as the guard roster grows.
 * - Performs a one-time migration on first import that removes any legacy
 *   base64 blobs that earlier code may have written.
 */

const PREFIX = "guard-profile-image:"
const META_VERSION = 2 // bumped whenever the stored format changes
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_ENTRIES = 20

type CacheEntry = { v: number; url: string; ts: number }

// Session-level flag — once set we skip all writes until the page reloads.
let quotaExceededThisSession = false

// ─── Internal helpers ────────────────────────────────────────────────────────

function isDev(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV === "development"
}

function log(...args: unknown[]): void {
  if (isDev()) console.warn("[guardImageStorage]", ...args)
}

function isBase64(value: string): boolean {
  return value.startsWith("data:")
}

function guardKeys(): string[] {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))
  } catch {
    return []
  }
}

/** Remove the oldest entries until we are at or below MAX_ENTRIES. */
function pruneOldest(): void {
  try {
    const keys = guardKeys()
    if (keys.length <= MAX_ENTRIES) return

    const sorted = keys
      .map((key) => {
        try {
          const raw = localStorage.getItem(key)
          const entry = raw ? (JSON.parse(raw) as CacheEntry) : null
          return { key, ts: entry?.ts ?? 0 }
        } catch {
          return { key, ts: 0 }
        }
      })
      .sort((a, b) => a.ts - b.ts)

    const toRemove = sorted.slice(0, sorted.length - MAX_ENTRIES)
    toRemove.forEach(({ key }) => {
      try { localStorage.removeItem(key) } catch { /* ignore */ }
    })

    log(`Pruned ${toRemove.length} oldest cache entries`)
  } catch {
    /* ignore */
  }
}

/** Remove entries whose TTL has expired. */
function pruneExpired(): void {
  try {
    const keys = guardKeys()
    const now = Date.now()
    keys.forEach((key) => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return
        const entry = JSON.parse(raw) as CacheEntry
        if (now - (entry.ts ?? 0) > TTL_MS) {
          localStorage.removeItem(key)
          log(`Evicted expired cache entry: ${key}`)
        }
      } catch {
        // Corrupt entry — remove it
        try { localStorage.removeItem(key) } catch { /* ignore */ }
      }
    })
  } catch {
    /* ignore */
  }
}

/**
 * One-time migration: removes any legacy base64 blobs written by older code.
 * Safe to call multiple times — exits early once migration is recorded.
 */
function migrateOnce(): void {
  if (typeof window === "undefined") return
  const migrationKey = `${PREFIX}__migrated_v${META_VERSION}`
  try {
    if (localStorage.getItem(migrationKey)) return
  } catch {
    return
  }

  try {
    const keys = guardKeys()
    let removed = 0
    keys.forEach((key) => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return
        // Legacy format: raw base64 string, or parsed entry with data: URL
        if (raw.startsWith("data:")) {
          localStorage.removeItem(key)
          removed++
          return
        }
        const entry = JSON.parse(raw) as CacheEntry
        if (isBase64(entry.url ?? "")) {
          localStorage.removeItem(key)
          removed++
        }
      } catch {
        // Corrupt entry
        try { localStorage.removeItem(key) } catch { /* ignore */ }
      }
    })
    if (removed > 0) log(`Migration: removed ${removed} legacy base64 cache entries`)
    localStorage.setItem(migrationKey, "1")
  } catch {
    /* Ignore — migration is best-effort */
  }
}

// Run migration as soon as this module is imported client-side.
if (typeof window !== "undefined") {
  migrateOnce()
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Cache a guard's profile image URL.
 *
 * Silently skips:
 * - base64 / data: URLs (too large for localStorage)
 * - any write after a QuotaExceededError in this session
 */
export function cacheGuardImageUrl(guardId: string, url: string): void {
  if (typeof window === "undefined") return
  if (isBase64(url)) {
    log(`Skipping base64 data URL for guard ${guardId} — too large for localStorage`)
    return
  }
  if (quotaExceededThisSession) {
    log(`Skipping write for guard ${guardId} — quota previously exceeded this session`)
    return
  }

  const key = `${PREFIX}${guardId}`
  const entry: CacheEntry = { v: META_VERSION, url, ts: Date.now() }
  try {
    localStorage.setItem(key, JSON.stringify(entry))
    pruneOldest()
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      quotaExceededThisSession = true
      log("QuotaExceededError — clearing guard image cache and disabling writes for this session")
      clearAllGuardImageCache()
    } else {
      log("localStorage.setItem failed:", err)
    }
  }
}

/**
 * Return the cached URL for a guard, or `null` if absent / expired / corrupt.
 */
export function getCachedGuardImageUrl(guardId: string): string | null {
  if (typeof window === "undefined") return null
  const key = `${PREFIX}${guardId}`
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    // Legacy raw base64 — remove and return null
    if (raw.startsWith("data:")) {
      localStorage.removeItem(key)
      log(`Evicted legacy base64 entry for guard ${guardId}`)
      return null
    }

    const entry = JSON.parse(raw) as CacheEntry
    if (isBase64(entry.url ?? "")) {
      localStorage.removeItem(key)
      log(`Evicted base64 entry (parsed) for guard ${guardId}`)
      return null
    }
    if (Date.now() - (entry.ts ?? 0) > TTL_MS) {
      localStorage.removeItem(key)
      log(`Evicted expired entry for guard ${guardId}`)
      return null
    }
    return entry.url
  } catch {
    // Corrupt entry
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    return null
  }
}

/** Remove the cached URL for a specific guard. */
export function removeCachedGuardImageUrl(guardId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(`${PREFIX}${guardId}`)
  } catch {
    /* ignore */
  }
}

/** Remove all guard image cache entries (e.g. after a quota failure). */
export function clearAllGuardImageCache(): void {
  if (typeof window === "undefined") return
  try {
    guardKeys().forEach((k) => {
      try { localStorage.removeItem(k) } catch { /* ignore */ }
    })
    log("Cleared all guard image cache entries")
  } catch {
    /* ignore */
  }
}

/** Call once on app startup (or from a layout) to evict stale/expired entries. */
export function runGuardImageCacheMaintenance(): void {
  if (typeof window === "undefined") return
  pruneExpired()
  pruneOldest()
}
