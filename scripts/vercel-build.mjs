import { spawnSync } from "node:child_process"

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])
const skipMigrations = TRUE_VALUES.has(
  String(process.env.SKIP_DB_MIGRATIONS ?? "").trim().toLowerCase()
)

const pooledUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL

const unpooledUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  pooledUrl

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

if (!pooledUrl && !skipMigrations) {
  console.error(
    "Missing database URL. Set DATABASE_URL (or POSTGRES_PRISMA_URL/POSTGRES_URL)."
  )
  process.exit(1)
}

if (!skipMigrations) {
  console.log("Running Prisma migrations...")
  run("npx", ["prisma", "migrate", "deploy"], {
    ...process.env,
    DATABASE_URL: unpooledUrl,
  })
} else {
  console.log("Skipping Prisma migrations because SKIP_DB_MIGRATIONS=true")
}

console.log("Building Next.js...")
run("npx", ["next", "build"], {
  ...process.env,
  ...(pooledUrl ? { DATABASE_URL: pooledUrl } : {}),
})
