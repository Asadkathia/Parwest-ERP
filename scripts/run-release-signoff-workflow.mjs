import { spawn } from 'node:child_process';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function envBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return TRUE_VALUES.has(String(raw).trim().toLowerCase());
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv },
      shell: false,
    });
    child.on('error', (error) => resolve({ ok: false, code: -1, error: error.message }));
    child.on('exit', (code, signal) => {
      if (signal) return resolve({ ok: false, code: -1, error: `terminated by ${signal}` });
      resolve({ ok: code === 0, code: code ?? -1 });
    });
  });
}

async function main() {
  const payloadPath = process.env.RELEASE_BULK_PAYLOAD_PATH;
  if (!payloadPath) {
    throw new Error('RELEASE_BULK_PAYLOAD_PATH is required.');
  }

  const apply = envBool('APPLY_SIGNOFF_UPDATE', false);
  const enforceGate = envBool('SIGNOFF_WORKFLOW_ENFORCE_GATE', false);

  console.log('[signoff-workflow] Step 1/4: bulk sync');
  const bulk = await run('npm', ['run', 'release:signoff:bulk'], {
    RELEASE_BULK_PAYLOAD_PATH: payloadPath,
    APPLY_SIGNOFF_UPDATE: apply ? 'true' : 'false',
  });
  if (!bulk.ok) {
    throw new Error(`release:signoff:bulk failed (code=${bulk.code})`);
  }

  console.log('[signoff-workflow] Step 2/4: recompute status');
  const status = await run('npm', ['run', 'release:signoff:status']);
  if (!status.ok) {
    throw new Error(`release:signoff:status failed (code=${status.code})`);
  }

  console.log('[signoff-workflow] Step 3/4: regenerate handoff');
  const handoff = await run('npm', ['run', 'release:signoff:handoff']);
  if (!handoff.ok) {
    throw new Error(`release:signoff:handoff failed (code=${handoff.code})`);
  }

  if (enforceGate) {
    console.log('[signoff-workflow] Step 4/4: enforce signoff gate');
    const gate = await run('npm', ['run', 'release:signoff:gate']);
    if (!gate.ok) {
      throw new Error(`release:signoff:gate failed (code=${gate.code})`);
    }
  } else {
    console.log('[signoff-workflow] Step 4/4: gate enforcement skipped');
  }

  console.log(
    `[signoff-workflow] Completed successfully (apply=${apply ? 'true' : 'false'}, enforceGate=${enforceGate ? 'true' : 'false'})`,
  );
}

main().catch((error) => {
  console.error('[signoff-workflow] Failed:', error.message);
  process.exit(1);
});
