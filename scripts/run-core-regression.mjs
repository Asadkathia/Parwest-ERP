import { spawn } from 'node:child_process';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function envBool(name, defaultValue) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return TRUE_VALUES.has(String(raw).trim().toLowerCase());
}

function runCommand(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv,
      },
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

async function main() {
  const runQuality = envBool('REGRESSION_RUN_CI_QUALITY', true);
  const runBuild = envBool('REGRESSION_RUN_BUILD', true);
  const runStrictReal = envBool('REGRESSION_RUN_STRICT_REAL', true);

  console.log('[core-regression] Profile:', {
    REGRESSION_RUN_CI_QUALITY: runQuality,
    REGRESSION_RUN_BUILD: runBuild,
    REGRESSION_RUN_STRICT_REAL: runStrictReal,
  });

  if (runQuality) {
    console.log('[core-regression] Running ci:quality...');
    await runCommand('npm', ['run', 'ci:quality']);
  }

  if (runBuild) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required when REGRESSION_RUN_BUILD=true.');
    }
    console.log('[core-regression] Running build...');
    await runCommand('npm', ['run', 'build']);
  }

  if (runStrictReal) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required when REGRESSION_RUN_STRICT_REAL=true.');
    }
    console.log('[core-regression] Running strict real integration profile...');
    await runCommand('npm', ['run', 'test:integration:strict-real']);
  }

  console.log('[core-regression] Completed successfully.');
}

main().catch((error) => {
  console.error('[core-regression] Failed:', error.message);
  process.exit(1);
});
