import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.STRICT_PROFILE_PORT || process.env.PORT || 3011);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const START_TIMEOUT_MS = Number(process.env.STRICT_START_TIMEOUT_MS || 120000);
const POLL_INTERVAL_MS = Number(process.env.STRICT_START_POLL_MS || 1500);

function withStrictEnv(extra = {}) {
  return {
    ...process.env,
    ...extra,
    USE_MOCKS: 'false',
    NEXT_PUBLIC_USE_MOCKS: 'false',
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: options.env || process.env,
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
        return;
      }
      resolve(undefined);
    });
  });
}

async function waitForServerHealth(baseUrl) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.ok) return;
    } catch {
      // server still starting
    }
    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`Server did not become ready within ${START_TIMEOUT_MS}ms at ${baseUrl}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for strict real-profile validation.');
  }

  console.log('[strict-real-profile] Seeding database in real mode...');
  await runCommand('npx', ['prisma', 'db', 'seed'], {
    env: withStrictEnv(),
  });

  console.log(`[strict-real-profile] Starting Next.js server on port ${PORT}...`);
  const serverEnv = withStrictEnv({
    NEXTAUTH_URL: `http://localhost:${PORT}`,
    AUTH_TRUST_HOST: 'true',
    PORT: String(PORT),
  });

  const server = spawn('npm', ['run', 'start', '--', '-p', String(PORT)], {
    stdio: 'inherit',
    env: serverEnv,
    shell: false,
  });

  const shutdown = () => {
    if (!server.killed) {
      server.kill('SIGTERM');
    }
  };

  process.on('SIGINT', () => {
    shutdown();
    process.exit(130);
  });

  process.on('SIGTERM', () => {
    shutdown();
    process.exit(143);
  });

  try {
    await waitForServerHealth(BASE_URL);

    console.log('[strict-real-profile] Running strict integration suite...');
    await runCommand('node', ['scripts/api-integration-test.mjs'], {
      env: withStrictEnv({
        BASE_URL,
        REQUIRE_REAL_SCOPE_ASSERTIONS: 'true',
        FAIL_ON_SCOPE_SKIP: 'true',
        REQUIRE_REAL_INVENTORY_ASSERTIONS: 'true',
        FAIL_ON_INVENTORY_SKIP: 'true',
      }),
    });
  } finally {
    shutdown();
    await delay(1500);
  }

  console.log('[strict-real-profile] Completed successfully.');
}

main().catch((error) => {
  console.error('[strict-real-profile] Failed:', error.message);
  process.exit(1);
});
