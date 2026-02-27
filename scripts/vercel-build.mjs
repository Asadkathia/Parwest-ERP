import { spawnSync } from "node:child_process"

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])
const skipMigrations = TRUE_VALUES.has(
  String(process.env.SKIP_DB_MIGRATIONS ?? "").trim().toLowerCase()
)
const skipSchemaVerification = TRUE_VALUES.has(
  String(process.env.SKIP_DB_SCHEMA_VERIFY ?? "").trim().toLowerCase()
)

const pooledUrl =
  process.env.DATABASE_URL

const unpooledUrl =
  process.env.DATABASE_URL_UNPOOLED ?? pooledUrl

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    env,
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  return result
}

function runStrict(command, args, env = process.env) {
  const result = run(command, args, env)
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function sleep(ms) {
  const view = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(view, 0, 0, ms)
}

function isAdvisoryLockTimeout(result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
  return /P1002|pg_advisory_lock|advisory lock/i.test(output)
}

if (!pooledUrl && !skipMigrations) {
  console.error(
    "Missing database URL. Set DATABASE_URL."
  )
  process.exit(1)
}

if (!skipMigrations) {
  const maxAttempts = Number(process.env.PRISMA_MIGRATE_MAX_ATTEMPTS ?? 4)
  let migrationSucceeded = false

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Running Prisma migrations (attempt ${attempt}/${maxAttempts})...`)
    const result = run("npx", ["prisma", "migrate", "deploy"], {
      ...process.env,
      DATABASE_URL: unpooledUrl,
    })

    if (result.status === 0) {
      migrationSucceeded = true
      break
    }

    if (!isAdvisoryLockTimeout(result) || attempt === maxAttempts) {
      process.exit(result.status ?? 1)
    }

    const delayMs = attempt * 5000
    console.warn(
      `Prisma migration lock timeout detected. Retrying in ${delayMs / 1000}s...`
    )
    sleep(delayMs)
  }

  if (!migrationSucceeded) {
    process.exit(1)
  }
} else {
  console.log("Skipping Prisma migrations because SKIP_DB_MIGRATIONS=true")
}

if (!skipSchemaVerification) {
  console.log("Verifying required DB tables...")
  runStrict("node", ["scripts/verify-db-schema.mjs"], {
    ...process.env,
    ...(pooledUrl ? { DATABASE_URL: pooledUrl } : {}),
  })
} else {
  console.log("Skipping DB schema verification because SKIP_DB_SCHEMA_VERIFY=true")
}

console.log("Building Next.js...")
runStrict("npx", ["next", "build"], {
  ...process.env,
  ...(pooledUrl ? { DATABASE_URL: pooledUrl } : {}),
})
