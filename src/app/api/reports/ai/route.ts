import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

type Mode = "report" | "query"

function hasAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

async function buildSummaryReport() {
  const [guards, activeGuards, pendingGuards, inactiveGuards, clients, activeClients, deployments, activeDeployments, branches, users] =
    await Promise.all([
      prisma.guard.count(),
      prisma.guard.count({ where: { status: "ACTIVE" } }),
      prisma.guard.count({ where: { status: "PENDING" } }),
      prisma.guard.count({ where: { status: "INACTIVE" } }),
      prisma.client.count(),
      prisma.client.count({ where: { status: "ACTIVE" } }),
      prisma.deployment.count(),
      prisma.deployment.count({ where: { status: "ACTIVE" } }),
      prisma.branch.count(),
      prisma.user.count(),
    ])

  return [
    "ERP Snapshot Report",
    `- Total guards: ${formatNumber(guards)} (active: ${formatNumber(activeGuards)}, pending: ${formatNumber(pendingGuards)}, inactive: ${formatNumber(inactiveGuards)})`,
    `- Total clients: ${formatNumber(clients)} (active: ${formatNumber(activeClients)})`,
    `- Total deployments: ${formatNumber(deployments)} (active: ${formatNumber(activeDeployments)})`,
    `- Total branches: ${formatNumber(branches)}`,
    `- Total users: ${formatNumber(users)}`,
  ].join("\n")
}

async function runPromptQuery(prompt: string) {
  const text = prompt.toLowerCase()

  if (hasAny(text, ["summary", "overview", "dashboard", "snapshot"])) {
    return buildSummaryReport()
  }

  if (hasAny(text, ["guards", "guard"])) {
    if (hasAny(text, ["inactive", "deactivated"])) {
      const count = await prisma.guard.count({ where: { status: "INACTIVE" } })
      return `Inactive guards: ${formatNumber(count)}`
    }
    if (hasAny(text, ["pending"])) {
      const count = await prisma.guard.count({ where: { status: "PENDING" } })
      return `Pending guards: ${formatNumber(count)}`
    }
    const count = await prisma.guard.count()
    return `Total guards: ${formatNumber(count)}`
  }

  if (hasAny(text, ["clients", "client"])) {
    if (hasAny(text, ["inactive", "deactivated"])) {
      const count = await prisma.client.count({ where: { status: "INACTIVE" } })
      return `Inactive clients: ${formatNumber(count)}`
    }
    const total = await prisma.client.count()
    const active = await prisma.client.count({ where: { status: "ACTIVE" } })
    return `Clients: ${formatNumber(total)} total, ${formatNumber(active)} active.`
  }

  if (hasAny(text, ["deployments", "deployment"])) {
    if (hasAny(text, ["active"])) {
      const active = await prisma.deployment.count({ where: { status: "ACTIVE" } })
      return `Active deployments: ${formatNumber(active)}`
    }
    const total = await prisma.deployment.count()
    return `Total deployments: ${formatNumber(total)}`
  }

  if (hasAny(text, ["branches", "branch"])) {
    const count = await prisma.branch.count()
    return `Total branches: ${formatNumber(count)}`
  }

  if (hasAny(text, ["users", "user"])) {
    const count = await prisma.user.count()
    return `Total users: ${formatNumber(count)}`
  }

  return [
    "I can answer count/summary queries from ERP data.",
    "Try prompts like:",
    '- \"Give me a dashboard summary\"',
    '- \"How many inactive guards do we have?\"',
    '- \"How many active deployments exist?\"',
    '- \"Total clients and active clients\"',
  ].join("\n")
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const prompt = String(body?.prompt || "").trim()
    const mode = (body?.mode === "report" ? "report" : "query") as Mode

    if (!prompt) {
      return NextResponse.json({ message: "Prompt is required" }, { status: 400 })
    }

    const answer = mode === "report" ? await buildSummaryReport() : await runPromptQuery(prompt)

    return NextResponse.json({
      answer,
      mode,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("AI report route error", error)
    return NextResponse.json({ message: "Failed to process AI query" }, { status: 500 })
  }
}
