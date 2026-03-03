import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const INPUT_PATH = process.env.STRICT_HEALTH_INPUT || '/tmp/api-test-results.json';
const OUTPUT_PATH = process.env.STRICT_HEALTH_OUTPUT || 'docs/strict-run-health.md';

const CORE_PREFIXES = [
  '/api/users',
  '/api/guards',
  '/api/deployments',
  '/api/attendance',
  '/api/clients',
  '/api/branches',
];

function asNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function summarizeCore(results) {
  const map = Object.fromEntries(CORE_PREFIXES.map((prefix) => [prefix, { total: 0, failed: 0 }]));
  let total = 0;
  let failed = 0;

  for (const row of results) {
    const prefix = CORE_PREFIXES.find((entry) => String(row.route || '').includes(entry));
    if (!prefix) continue;

    map[prefix].total += 1;
    total += 1;
    if (row.status !== 'PASS') {
      map[prefix].failed += 1;
      failed += 1;
    }
  }

  return { byPrefix: map, total, failed };
}

function pct(part, whole) {
  if (!whole) return 0;
  return Number(((part / whole) * 100).toFixed(2));
}

function main() {
  if (!existsSync(INPUT_PATH)) {
    throw new Error(`Input results not found at ${INPUT_PATH}`);
  }

  const parsed = JSON.parse(readFileSync(INPUT_PATH, 'utf8'));
  const summary = parsed?.summary || { total: 0, passed: 0, failed: 0 };
  const results = Array.isArray(parsed?.results) ? parsed.results : [];

  const total = Number(summary.total || 0);
  const passed = Number(summary.passed || 0);
  const failed = Number(summary.failed || 0);
  const passRate = total > 0 ? passed / total : 0;

  const core = summarizeCore(results);
  const missingCoreCoverage = CORE_PREFIXES.filter((prefix) => core.byPrefix[prefix].total === 0);

  const maxFailed = asNumber('STRICT_HEALTH_MAX_FAILED', 0);
  const minTotal = asNumber('STRICT_HEALTH_MIN_TOTAL', 200);
  const minPassRate = asNumber('STRICT_HEALTH_MIN_PASS_RATE', 1);

  const checks = {
    maxFailed: failed <= maxFailed,
    minTotal: total >= minTotal,
    minPassRate: passRate >= minPassRate,
    coreCoverage: missingCoreCoverage.length === 0,
    coreFailures: core.failed === 0,
  };

  const healthy = Object.values(checks).every(Boolean);

  const lines = [
    '# Strict Run Health Report',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Input: ${INPUT_PATH}`,
    `Overall status: ${healthy ? 'PASS' : 'FAIL'}`,
    '',
    '## Global Summary',
    `- total: ${total}`,
    `- passed: ${passed}`,
    `- failed: ${failed}`,
    `- pass rate: ${pct(passed, total)}%`,
    '',
    '## Thresholds',
    `- max failed <= ${maxFailed}: ${checks.maxFailed ? 'PASS' : 'FAIL'}`,
    `- min total >= ${minTotal}: ${checks.minTotal ? 'PASS' : 'FAIL'}`,
    `- min pass rate >= ${(minPassRate * 100).toFixed(2)}%: ${checks.minPassRate ? 'PASS' : 'FAIL'}`,
    `- core coverage present: ${checks.coreCoverage ? 'PASS' : 'FAIL'}`,
    `- core failures == 0: ${checks.coreFailures ? 'PASS' : 'FAIL'}`,
    '',
    '## Core Route Coverage',
    ...CORE_PREFIXES.map((prefix) => {
      const item = core.byPrefix[prefix];
      return `- ${prefix}: total=${item.total}, failed=${item.failed}`;
    }),
    '',
    `Missing core coverage: ${missingCoreCoverage.length ? missingCoreCoverage.join(', ') : 'none'}`,
  ];

  writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8');
  console.log(`[strict-health] Wrote ${OUTPUT_PATH}`);

  if (!healthy) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error('[strict-health] Failed:', error.message);
  process.exit(1);
}
