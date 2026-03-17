import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const stages = {
  A: { enabled: true, writeEnabled: false, readFromV2: false, legacyReadonly: false, cutoverComplete: false },
  B: { enabled: true, writeEnabled: true, readFromV2: false, legacyReadonly: false, cutoverComplete: false },
  C: { enabled: true, writeEnabled: true, readFromV2: true, legacyReadonly: false, cutoverComplete: false },
  D: { enabled: true, writeEnabled: true, readFromV2: true, legacyReadonly: true, cutoverComplete: false },
  E: { enabled: true, writeEnabled: true, readFromV2: true, legacyReadonly: true, cutoverComplete: true },
};

const mapping = [
  ['enabled', 'INVENTORY_V2_ENABLED'],
  ['writeEnabled', 'INVENTORY_V2_WRITE_ENABLED'],
  ['readFromV2', 'INVENTORY_V2_READ_FROM_V2'],
  ['legacyReadonly', 'INVENTORY_V2_LEGACY_READONLY'],
  ['cutoverComplete', 'INVENTORY_V2_CUTOVER_COMPLETE'],
];

function boolToString(value) {
  return value ? 'true' : 'false';
}

function stageBlock(stageKey, flags) {
  const lines = [];
  lines.push(`## Stage ${stageKey}`);
  lines.push('');
  lines.push('```bash');
  for (const [key, envKey] of mapping) {
    lines.push(`export ${envKey}=${boolToString(flags[key])}`);
  }
  for (const [key, envKey] of mapping) {
    lines.push(`export NEXT_PUBLIC_${envKey}=${boolToString(flags[key])}`);
  }
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const outputPath = process.env.INVENTORY_V2_STAGE_ENV_PATH || path.resolve(process.cwd(), 'docs/inventory-v2-stage-env-snippets.md');

  const lines = [];
  lines.push('# Inventory V2 Stage Env Snippets');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Use these exports in your deployment environment for each rollout stage.');
  lines.push('Apply server and NEXT_PUBLIC values together.');
  lines.push('');

  for (const stageKey of ['A', 'B', 'C', 'D', 'E']) {
    lines.push(stageBlock(stageKey, stages[stageKey]));
  }

  await fs.writeFile(outputPath, `${lines.join('\n')}\n`);
  console.log(`[inventory-v2-stage-env] Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error('[inventory-v2-stage-env] Failed:', error.message);
  process.exit(1);
});
