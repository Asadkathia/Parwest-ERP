/**
 * Escape a single CSV cell: wrap in double quotes and double any embedded
 * quotes (RFC 4180). Null/undefined becomes an empty quoted cell.
 *
 * Shared by the client export routes. `src/app/api/guards/export/route.ts`
 * keeps its own local copy (established pattern, out of scope here).
 */
export function csvEscape(val: string | null | undefined): string {
  return '"' + (val ?? "").replace(/"/g, '""') + '"'
}
