/**
 * Shared validator utilities for store-inventory v2 API routes.
 *
 * Only functions that are truly identical across multiple route files live here.
 * Domain-specific normalizers (e.g. adjustments' WEAPON_AMMO scope, inventories'
 * three-way WEAPON/AMMO/NON_WEAPON scope) remain local to their respective routes.
 */

/** The two-value weapon scope used by assignments and purchases routes. */
export type CategoryScope = "NON_WEAPON" | "WEAPON"

/**
 * Returns true when a product category name indicates a weapon or ammunition item.
 * Used by assignments, purchases, and demands routes for category-based validation.
 */
export function isWeaponCategoryName(value: string | null | undefined): boolean {
  const text = String(value ?? "").trim().toLowerCase()
  return text.includes("weapon") || text.includes("ammo")
}

/**
 * Coerces an unknown value to the two-value CategoryScope.
 * Used by assignments and purchases routes.
 */
export function normalizeCategoryScope(value: unknown): CategoryScope {
  const raw = String(value ?? "").trim().toUpperCase()
  return raw === "WEAPON" ? "WEAPON" : "NON_WEAPON"
}
