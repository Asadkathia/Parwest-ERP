import { promises as fs } from "fs"
import path from "path"
import { seedFingerprintDevices } from "@/lib/fingerprint/seed-devices"

export type FingerprintDeviceStatus = "ONLINE" | "OFFLINE" | "WARNING"

export type FingerprintDeviceRecord = {
  id: string
  name: string
  officeId: string
  officeName: string
  status: FingerprintDeviceStatus
  lastSyncAt: string
  pendingEnrollments: number
  createdAt: string
  updatedAt: string
}

const DATA_DIR = path.join(process.cwd(), "data")
const STORE_FILE = path.join(DATA_DIR, "fingerprint-devices.json")

function toSeedRecord(device: (typeof seedFingerprintDevices)[number]): FingerprintDeviceRecord {
  const now = new Date().toISOString()
  return {
    ...device,
    pendingEnrollments: 0,
    createdAt: now,
    updatedAt: now,
  }
}

async function ensureStoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try {
    await fs.access(STORE_FILE)
  } catch {
    const seed = seedFingerprintDevices.map(toSeedRecord)
    await fs.writeFile(STORE_FILE, JSON.stringify(seed, null, 2), "utf8")
  }
}

export async function readFingerprintDevices() {
  await ensureStoreFile()
  const raw = await fs.readFile(STORE_FILE, "utf8")
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) return [] as FingerprintDeviceRecord[]
  return parsed as FingerprintDeviceRecord[]
}

export async function writeFingerprintDevices(rows: FingerprintDeviceRecord[]) {
  await ensureStoreFile()
  await fs.writeFile(STORE_FILE, JSON.stringify(rows, null, 2), "utf8")
}

export async function updateFingerprintDevices(
  mutate: (rows: FingerprintDeviceRecord[]) => FingerprintDeviceRecord[]
) {
  const current = await readFingerprintDevices()
  const next = mutate(current)
  await writeFingerprintDevices(next)
  return next
}
