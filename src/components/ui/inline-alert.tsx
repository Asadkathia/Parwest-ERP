import { cn } from "@/lib/utils"

type Props = {
  type: "success" | "error"
  message: string
}

export default function InlineAlert({ type, message }: Props) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border px-4 py-3 text-sm font-medium",
        type === "success" && "border-green-200 bg-green-50 text-green-800",
        type === "error" && "border-red-200 bg-red-50 text-red-700"
      )}
    >
      {message}
    </div>
  )
}
