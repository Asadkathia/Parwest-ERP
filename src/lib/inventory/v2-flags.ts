export type InventoryV2Flags = {
  writeEnabled: boolean
}

function parseBoolean(raw: string | undefined): boolean {
  if (!raw) return false
  const normalized = raw.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function getInventoryV2Flags(): InventoryV2Flags {
  return {
    writeEnabled: parseBoolean(process.env.INVENTORY_V2_WRITE_ENABLED),
  }
}
