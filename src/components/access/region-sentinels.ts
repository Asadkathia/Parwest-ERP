/**
 * Shared sentinels for region-filter URL params. Lives outside the
 * "use client" picker module so server components can import the literal
 * string value (Next.js treats exports from client modules as opaque
 * client-reference proxies, so comparing against them server-side fails).
 */
export const GLOBAL_REGION_VALUE = "__GLOBAL__"
