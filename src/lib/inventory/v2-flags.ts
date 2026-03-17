export type InventoryV2Flags = {
  enabled: boolean
  readFromV2: boolean
  writeEnabled: boolean
  legacyReadonly: boolean
  cutoverComplete: boolean
}

function parseBoolean(raw: string | undefined): boolean {
  if (!raw) return false
  const normalized = raw.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function getInventoryV2Flags(): InventoryV2Flags {
  return {
    enabled: parseBoolean(process.env.INVENTORY_V2_ENABLED),
    readFromV2: parseBoolean(process.env.INVENTORY_V2_READ_FROM_V2),
    writeEnabled: parseBoolean(process.env.INVENTORY_V2_WRITE_ENABLED),
    legacyReadonly: parseBoolean(process.env.INVENTORY_V2_LEGACY_READONLY),
    cutoverComplete: parseBoolean(process.env.INVENTORY_V2_CUTOVER_COMPLETE),
  }
}

export function getPublicInventoryV2Flags(): InventoryV2Flags {
  return {
    enabled: parseBoolean(process.env.NEXT_PUBLIC_INVENTORY_V2_ENABLED),
    readFromV2: parseBoolean(process.env.NEXT_PUBLIC_INVENTORY_V2_READ_FROM_V2),
    writeEnabled: parseBoolean(process.env.NEXT_PUBLIC_INVENTORY_V2_WRITE_ENABLED),
    legacyReadonly: parseBoolean(process.env.NEXT_PUBLIC_INVENTORY_V2_LEGACY_READONLY),
    cutoverComplete: parseBoolean(process.env.NEXT_PUBLIC_INVENTORY_V2_CUTOVER_COMPLETE),
  }
}
