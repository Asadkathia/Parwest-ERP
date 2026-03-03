import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const RESULTS_PATH = '/tmp/api-test-results.json';
const REPORT_PATH = 'docs/core-regression-users-guards-clients.md';
const THRESHOLDS_PATH = 'docs/core-regression-thresholds.json';

const CORE_PREFIXES = [
  '/api/users',
  '/api/guards',
  '/api/deployments',
  '/api/attendance',
  '/api/clients',
  '/api/branches',
];

const DEFAULT_THRESHOLDS = {
  minCoreTotal: 70,
  minByPrefix: {
    '/api/users': 36,
    '/api/guards': 4,
    '/api/deployments': 11,
    '/api/attendance': 6,
    '/api/clients': 7,
    '/api/branches': 6,
  },
};

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

function toSafeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadThresholds() {
  if (!existsSync(THRESHOLDS_PATH)) {
    return DEFAULT_THRESHOLDS;
  }

  try {
    const parsed = JSON.parse(readFileSync(THRESHOLDS_PATH, 'utf8'));
    const minCoreTotal = toSafeNumber(parsed?.minCoreTotal, DEFAULT_THRESHOLDS.minCoreTotal);
    const minByPrefix = Object.fromEntries(
      CORE_PREFIXES.map((prefix) => [
        prefix,
        toSafeNumber(parsed?.minByPrefix?.[prefix], DEFAULT_THRESHOLDS.minByPrefix[prefix]),
      ]),
    );

    return { minCoreTotal, minByPrefix };
  } catch (error) {
    throw new Error(`Failed to parse ${THRESHOLDS_PATH}: ${error.message}`);
  }
}

function summarizeCore(results) {
  const byPrefix = Object.fromEntries(CORE_PREFIXES.map((prefix) => [prefix, { total: 0, failed: 0 }]));
  let coreTotal = 0;
  let coreFailed = 0;

  for (const row of results) {
    const matched = CORE_PREFIXES.find((prefix) => row.route.includes(prefix));
    if (!matched) continue;

    byPrefix[matched].total += 1;
    coreTotal += 1;

    if (row.status !== 'PASS') {
      byPrefix[matched].failed += 1;
      coreFailed += 1;
    }
  }

  return { byPrefix, coreTotal, coreFailed };
}

async function main() {
  const runStrictReal = envBool('QA_CORE_RUN_STRICT_REAL', true);
  const thresholds = loadThresholds();

  if (runStrictReal) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required when QA_CORE_RUN_STRICT_REAL=true.');
    }
    console.log('[sprint-core-regression] Running strict real integration before verification...');
    const res = await run('npm', ['run', 'test:integration:strict-real']);
    if (!res.ok) {
      throw new Error(`strict real integration failed (code=${res.code})`);
    }
  }

  if (!existsSync(RESULTS_PATH)) {
    throw new Error(`${RESULTS_PATH} does not exist. Run integration suite first.`);
  }

  const parsed = JSON.parse(readFileSync(RESULTS_PATH, 'utf8'));
  const summary = parsed?.summary || { total: 0, passed: 0, failed: 0 };
  const results = Array.isArray(parsed?.results) ? parsed.results : [];

  const core = summarizeCore(results);
  const missingCoverage = CORE_PREFIXES.filter((prefix) => core.byPrefix[prefix].total === 0);
  const driftViolations = [];

  if (core.coreTotal < thresholds.minCoreTotal) {
    driftViolations.push(
      `core total below threshold (${core.coreTotal} < ${thresholds.minCoreTotal})`,
    );
  }

  for (const prefix of CORE_PREFIXES) {
    const current = core.byPrefix[prefix].total;
    const minimum = thresholds.minByPrefix[prefix];
    if (current < minimum) {
      driftViolations.push(`${prefix} below threshold (${current} < ${minimum})`);
    }
  }

  const pass =
    summary.failed === 0 &&
    core.coreFailed === 0 &&
    missingCoverage.length === 0 &&
    driftViolations.length === 0;

  const md = [
    '# Sprint Core Regression Proof (Users + Guards + Clients)',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Integration total: ${summary.passed}/${summary.total} pass, failed=${summary.failed}`,
    `Core subset total: ${core.coreTotal}, failed=${core.coreFailed}`,
    '',
    '## Drift Guardrails',
    `- Threshold file: \`${THRESHOLDS_PATH}\``,
    `- Minimum core total: ${thresholds.minCoreTotal}`,
    ...CORE_PREFIXES.map(
      (prefix) => `- Minimum ${prefix}: ${thresholds.minByPrefix[prefix]}`,
    ),
    '',
    '## Coverage by Route Prefix',
    ...CORE_PREFIXES.map((prefix) => `- ${prefix}: total=${core.byPrefix[prefix].total}, failed=${core.byPrefix[prefix].failed}`),
    '',
    `Missing coverage: ${missingCoverage.length ? missingCoverage.join(', ') : 'none'}`,
    `Drift violations: ${driftViolations.length ? driftViolations.join('; ') : 'none'}`,
    `Verification result: ${pass ? 'PASS' : 'FAIL'}`,
  ].join('\n');

  writeFileSync(REPORT_PATH, md, 'utf8');
  console.log(`[sprint-core-regression] Wrote ${REPORT_PATH}`);

  if (!pass) {
    throw new Error('Core regression verification failed. See generated report.');
  }
}

main().catch((error) => {
  console.error('[sprint-core-regression] Failed:', error.message);
  process.exit(1);
});
