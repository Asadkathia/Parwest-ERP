import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function envBool(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return TRUE_VALUES.has(String(raw).trim().toLowerCase());
}

function expectedForStage(stage) {
  const base = {
    enabled: false,
    writeEnabled: false,
    readFromV2: false,
    legacyReadonly: false,
    cutoverComplete: false,
  };

  if (stage === 'A') return { ...base, enabled: true };
  if (stage === 'B') return { ...base, enabled: true, writeEnabled: true };
  if (stage === 'C') return { ...base, enabled: true, writeEnabled: true, readFromV2: true };
  if (stage === 'D') return { ...base, enabled: true, writeEnabled: true, readFromV2: true, legacyReadonly: true };
  if (stage === 'E') return { ...base, enabled: true, writeEnabled: true, readFromV2: true, legacyReadonly: true, cutoverComplete: true };
  return null;
}

function collectFlags(prefix = '') {
  return {
    enabled: envBool(`${prefix}INVENTORY_V2_ENABLED`),
    writeEnabled: envBool(`${prefix}INVENTORY_V2_WRITE_ENABLED`),
    readFromV2: envBool(`${prefix}INVENTORY_V2_READ_FROM_V2`),
    legacyReadonly: envBool(`${prefix}INVENTORY_V2_LEGACY_READONLY`),
    cutoverComplete: envBool(`${prefix}INVENTORY_V2_CUTOVER_COMPLETE`),
  };
}

function compare(actual, expected) {
  const mismatches = [];
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) {
      mismatches.push({ key, expected: expected[key], actual: actual[key] });
    }
  }
  return mismatches;
}

async function main() {
  const stageRaw = (process.env.INVENTORY_V2_EXPECTED_STAGE || 'D').trim().toUpperCase();
  const stage = ['A', 'B', 'C', 'D', 'E'].includes(stageRaw) ? stageRaw : 'D';
  const expected = expectedForStage(stage);
  const serverFlags = collectFlags('');
  const publicFlags = collectFlags('NEXT_PUBLIC_');

  const serverMismatches = compare(serverFlags, expected);
  const publicMismatches = compare(publicFlags, expected);

  const report = {
    generatedAt: new Date().toISOString(),
    expectedStage: stage,
    expected,
    serverFlags,
    publicFlags,
    pass: serverMismatches.length === 0 && publicMismatches.length === 0,
    serverMismatches,
    publicMismatches,
  };

  const outPath = process.env.INVENTORY_V2_FLAGS_REPORT_PATH || path.resolve(process.cwd(), 'docs/inventory-v2-flag-status.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  console.log(`[inventory-v2-flags] Generated: ${report.generatedAt}`);
  console.log(`[inventory-v2-flags] Expected stage: ${stage}`);
  console.log(`[inventory-v2-flags] Server flags: ${JSON.stringify(serverFlags)}`);
  console.log(`[inventory-v2-flags] Public flags: ${JSON.stringify(publicFlags)}`);
  console.log(`[inventory-v2-flags] Pass: ${report.pass}`);
  if (!report.pass) {
    for (const mismatch of serverMismatches) {
      console.log(`[inventory-v2-flags] Server mismatch ${mismatch.key}: expected=${mismatch.expected} actual=${mismatch.actual}`);
    }
    for (const mismatch of publicMismatches) {
      console.log(`[inventory-v2-flags] Public mismatch ${mismatch.key}: expected=${mismatch.expected} actual=${mismatch.actual}`);
    }
  }
  console.log(`[inventory-v2-flags] Wrote ${outPath}`);

  if (envBool('INVENTORY_V2_FLAGS_FAIL_ON_MISMATCH', false) && !report.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[inventory-v2-flags] Failed:', error.message);
  process.exit(1);
});
