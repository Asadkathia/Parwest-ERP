import { notFound } from "next/navigation"
import ImportsLifecycleManager from "@/components/imports/ImportsLifecycleManager"

export default async function ImportScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const supported = ["users", "guards", "clients", "inventory"]

  if (!supported.includes(screen)) {
    notFound()
  }

  return <ImportsLifecycleManager initialModule={screen as "users" | "guards" | "clients" | "inventory"} />
}
