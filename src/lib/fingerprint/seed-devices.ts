// Seed data used to initialize the file-backed fingerprint device store on first
// run (data/fingerprint-devices.json). This is real seed data for the fingerprint
// feature — NOT part of the removed "mock mode".
export type FingerprintDeviceStatus = "ONLINE" | "OFFLINE" | "WARNING"

export type FingerprintDevice = {
  id: string
  name: string
  officeId: string
  officeName: string
  status: FingerprintDeviceStatus
  lastSyncAt: string
}

export const seedFingerprintDevices: FingerprintDevice[] = [
  {
    id: "fp-1",
    name: "ZKTeco-LHR-01",
    officeId: "office-lhr",
    officeName: "Lahore Head Office",
    status: "ONLINE",
    lastSyncAt: "2026-02-17T08:00:00.000Z",
  },
  {
    id: "fp-2",
    name: "ZKTeco-KHI-03",
    officeId: "office-khi",
    officeName: "Karachi Regional Office",
    status: "WARNING",
    lastSyncAt: "2026-02-16T22:40:00.000Z",
  },
  {
    id: "fp-3",
    name: "Suprema-ISB-02",
    officeId: "office-isb",
    officeName: "Islamabad Regional Office",
    status: "OFFLINE",
    lastSyncAt: "2026-02-14T10:10:00.000Z",
  },
]
