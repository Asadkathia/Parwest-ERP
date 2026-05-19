import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { DraftEditor } from "@/components/imports/draft-editor/DraftEditor"

export default async function DraftEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasAction(session, "IMPORTS", "VIEW")) redirect("/")
  const { id } = await params
  return <DraftEditor draftId={id} />
}
