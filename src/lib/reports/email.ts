import nodemailer from "nodemailer"
import { getArtifact } from "./storage"

export interface EmailRunInput {
  recipients: string[]
  subject: string
  body: string
  attachments: { fileKey: string; filename: string; contentType: string }[]
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM)
}

export async function sendReportEmail(input: EmailRunInput): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn("[reports] SMTP not configured; skipping email", input.subject)
    return
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
  const attachments = await Promise.all(
    input.attachments.map(async (a) => ({
      filename: a.filename,
      content: await getArtifact(a.fileKey),
      contentType: a.contentType,
    }))
  )
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: input.recipients.join(", "),
    subject: input.subject,
    text: input.body,
    attachments,
  })
}
