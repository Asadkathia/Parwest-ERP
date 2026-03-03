#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

function parseArgs(argv) {
  const args = { current: "", baseline: "" }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === "--current") args.current = argv[i + 1] || ""
    if (token === "--baseline") args.baseline = argv[i + 1] || ""
  }
  return args
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function summarizeLintReport(report) {
  const out = {
    totals: { errors: 0, warnings: 0, problems: 0 },
    ruleCounts: {},
  }

  for (const file of report) {
    out.totals.errors += Number(file.errorCount || 0)
    out.totals.warnings += Number(file.warningCount || 0)
    for (const msg of file.messages || []) {
      if (!msg.ruleId) continue
      out.ruleCounts[msg.ruleId] = (out.ruleCounts[msg.ruleId] || 0) + 1
    }
  }
  out.totals.problems = out.totals.errors + out.totals.warnings
  return out
}

function compare(current, baseline) {
  const failures = []

  if (current.totals.errors > baseline.totals.errors) {
    failures.push(
      `Error count increased: ${baseline.totals.errors} -> ${current.totals.errors}`
    )
  }
  if (current.totals.warnings > baseline.totals.warnings) {
    failures.push(
      `Warning count increased: ${baseline.totals.warnings} -> ${current.totals.warnings}`
    )
  }
  if (current.totals.problems > baseline.totals.problems) {
    failures.push(
      `Problem count increased: ${baseline.totals.problems} -> ${current.totals.problems}`
    )
  }

  const baselineRules = baseline.ruleCounts || {}
  const currentRules = current.ruleCounts || {}
  const allRules = new Set([...Object.keys(baselineRules), ...Object.keys(currentRules)])

  for (const rule of allRules) {
    const before = Number(baselineRules[rule] || 0)
    const after = Number(currentRules[rule] || 0)
    if (after > before) {
      failures.push(`Rule increased (${rule}): ${before} -> ${after}`)
    }
  }

  return failures
}

function main() {
  const args = parseArgs(process.argv)
  const currentPath = args.current || "/tmp/eslint-report-current.json"
  const baselinePath = args.baseline || "docs/lint-baseline.json"

  if (!fs.existsSync(currentPath)) {
    console.error(`Current lint report not found: ${currentPath}`)
    process.exit(1)
  }
  if (!fs.existsSync(baselinePath)) {
    console.error(`Baseline lint file not found: ${baselinePath}`)
    process.exit(1)
  }

  const currentReport = readJson(currentPath)
  const baseline = readJson(baselinePath)
  const current = summarizeLintReport(currentReport)
  const failures = compare(current, baseline)

  const cwd = process.cwd()
  console.log("Lint guard summary")
  console.log(`- current: ${path.relative(cwd, currentPath)}`)
  console.log(`- baseline: ${path.relative(cwd, baselinePath)}`)
  console.log(
    `- totals: errors=${current.totals.errors}, warnings=${current.totals.warnings}, problems=${current.totals.problems}`
  )

  if (failures.length > 0) {
    console.error("No-net-new-lint check failed:")
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log("No-net-new-lint check passed.")
}

main()

