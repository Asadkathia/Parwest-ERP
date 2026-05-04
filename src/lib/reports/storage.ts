import { prisma } from "@/lib/db"

export interface StoredArtifact {
  fileKey: string
  size: number
}

const useS3 = Boolean(process.env.REPORTS_S3_BUCKET)

export type ReportFileExt = "csv" | "xlsx" | "pdf"

// S3 path is opt-in; @aws-sdk/client-s3 is loaded only when REPORTS_S3_BUCKET
// is set so the package is not a hard dependency.
async function loadS3(): Promise<{
  put: (key: string, body: Buffer) => Promise<void>
  get: (key: string) => Promise<Buffer>
}> {
  // Use Function constructor to bypass static resolution; the package may not
  // be installed when S3 isn't in use.
  const dyn = new Function("m", "return import(m)") as (m: string) => Promise<unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aws = (await dyn("@aws-sdk/client-s3")) as any
  const s3 = new aws.S3Client({ region: process.env.REPORTS_S3_REGION })
  const Bucket = process.env.REPORTS_S3_BUCKET!
  return {
    async put(Key, Body) {
      await s3.send(new aws.PutObjectCommand({ Bucket, Key, Body }))
    },
    async get(Key) {
      const res = await s3.send(new aws.GetObjectCommand({ Bucket, Key }))
      const chunks: Buffer[] = []
      for await (const chunk of res.Body as AsyncIterable<Buffer>) {
        chunks.push(chunk as Buffer)
      }
      return Buffer.concat(chunks)
    },
  }
}

export async function putArtifact(
  runId: string,
  bytes: Buffer,
  ext: ReportFileExt
): Promise<StoredArtifact> {
  const fileKey = `reports/${runId}.${ext}`
  if (useS3) {
    const s3 = await loadS3()
    await s3.put(fileKey, bytes)
  } else {
    const ab = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(ab).set(bytes)
    const bytesU8 = new Uint8Array(ab)
    await prisma.reportRunBlob.upsert({
      where: { fileKey },
      create: { fileKey, bytes: bytesU8 },
      update: { bytes: bytesU8 },
    })
  }
  return { fileKey, size: bytes.byteLength }
}

export async function getArtifact(fileKey: string): Promise<Buffer> {
  if (useS3) {
    const s3 = await loadS3()
    return s3.get(fileKey)
  }
  const row = await prisma.reportRunBlob.findUnique({ where: { fileKey } })
  if (!row) throw new Error(`Artifact not found: ${fileKey}`)
  return Buffer.from(row.bytes)
}

export function contentTypeFor(ext: ReportFileExt): string {
  if (ext === "csv") return "text/csv"
  if (ext === "xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
  return "application/pdf"
}
