import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import process from 'node:process';
import path from 'node:path';
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

function parseLintTotals(reportPath) {
  try {
    const raw = readFileSync(reportPath, 'utf8');
    const rows = JSON.parse(raw);
    let errors = 0;
    let warnings = 0;
    let problems = 0;
    for (const file of rows) {
      errors += Number(file.errorCount || 0);
      warnings += Number(file.warningCount || 0);
      problems += Number(file.errorCount || 0) + Number(file.warningCount || 0);
    }
    return { errors, warnings, problems };
  } catch {
    return null;
  }
}

function parseIntegrationSummary(resultsPath) {
  try {
    const raw = readFileSync(resultsPath, 'utf8');
    const parsed = JSON.parse(raw);
    const summary = parsed?.summary;
    if (!summary) return null;
    return {
      total: Number(summary.total || 0),
      passed: Number(summary.passed || 0),
      failed: Number(summary.failed || 0),
    };
  } catch {
    return null;
  }
}

function gitShortHead() {
  return new Promise((resolve) => {
    const child = spawn('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.on('exit', () => resolve(out.trim() || 'unknown'));
    child.on('error', () => resolve('unknown'));
  });
}

function toSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function validateSignoffLinks(candidateId, evidencePath) {
  const slug = toSlug(candidateId);
  const signoffPath =
    process.env.RELEASE_SIGNOFF_PATH || path.join('docs', `release-signoff-${slug}.md`);

  if (!existsSync(signoffPath)) {
    return {
      ok: false,
      signoffPath,
      message: `signoff packet missing: ${signoffPath}`,
    };
  }

  const signoffBody = readFileSync(signoffPath, 'utf8');
  const expectedEvidenceLink = evidencePath.replace(/\\/g, '/');
  const expectedHealthLink = 'docs/strict-run-health.md';
  const expectedHeading = `# Release Signoff Packet - ${candidateId}`;

  const hasHeading = signoffBody.includes(expectedHeading);
  const hasEvidenceLink = signoffBody.includes(expectedEvidenceLink);
  const hasHealthLink = signoffBody.includes(expectedHealthLink);

  const missing = [];
  if (!hasHeading) missing.push(`heading "${expectedHeading}"`);
  if (!hasEvidenceLink) missing.push(`evidence link "${expectedEvidenceLink}"`);
  if (!hasHealthLink) missing.push(`health link "${expectedHealthLink}"`);

  if (missing.length > 0) {
    return {
      ok: false,
      signoffPath,
      message: `signoff packet missing required entries: ${missing.join(', ')}`,
    };
  }

  if (!existsSync(expectedEvidenceLink)) {
    return {
      ok: false,
      signoffPath,
      message: `linked evidence file does not exist: ${expectedEvidenceLink}`,
    };
  }

  if (!existsSync(expectedHealthLink)) {
    return {
      ok: false,
      signoffPath,
      message: `linked health file does not exist: ${expectedHealthLink}`,
    };
  }

  return { ok: true, signoffPath, message: 'links valid' };
}

async function main() {
  const candidateId = process.env.RELEASE_CANDIDATE_ID || 'RC-2026-03-02-01';
  const runQuality = envBool('SNAPSHOT_RUN_CI_QUALITY', true);
  const runBuild = envBool('SNAPSHOT_RUN_BUILD', true);
  const runStrict = envBool('SNAPSHOT_RUN_STRICT_REAL', true);

  const status = {
    ciQuality: { ok: null, note: 'not-run' },
    build: { ok: null, note: 'not-run' },
    strictReal: { ok: null, note: 'not-run' },
  };

  if (runQuality) {
    console.log('[release-snapshot] Running ci:quality');
    const res = await run('npm', ['run', 'ci:quality']);
    status.ciQuality = { ok: res.ok, note: res.ok ? 'pass' : `failed (code=${res.code})` };
  }

  if (runBuild) {
    if (!process.env.DATABASE_URL) {
      status.build = { ok: false, note: 'failed (DATABASE_URL missing)' };
    } else if (status.ciQuality.ok === false) {
      status.build = { ok: null, note: 'skipped (ci:quality failed)' };
    } else {
      console.log('[release-snapshot] Running build');
      const res = await run('npm', ['run', 'build']);
      status.build = { ok: res.ok, note: res.ok ? 'pass' : `failed (code=${res.code})` };
    }
  }

  if (runStrict) {
    if (!process.env.DATABASE_URL) {
      status.strictReal = { ok: false, note: 'failed (DATABASE_URL missing)' };
    } else if (status.build.ok === false) {
      status.strictReal = { ok: null, note: 'skipped (build failed)' };
    } else {
      console.log('[release-snapshot] Running strict real integration');
      const res = await run('npm', ['run', 'test:integration:strict-real']);
      status.strictReal = { ok: res.ok, note: res.ok ? 'pass' : `failed (code=${res.code})` };
    }
  }

  const lintTotals = parseLintTotals('/tmp/eslint-report-current.json');
  const integration = parseIntegrationSummary('/tmp/api-test-results.json');
  const commit = await gitShortHead();
  const nowIso = new Date().toISOString();

  const outPath = path.join('docs', `release-evidence-${toSlug(candidateId)}.md`);
  const markdown = [
    `# Release Evidence Snapshot - ${candidateId}`,
    '',
    `Generated at: ${nowIso}`,
    `Commit: \`${commit}\``,
    '',
    '## Gate Status',
    `- ci:quality: ${status.ciQuality.ok === true ? '`PASS`' : status.ciQuality.ok === false ? '`FAIL`' : '`SKIP`'} (${status.ciQuality.note})`,
    `- build: ${status.build.ok === true ? '`PASS`' : status.build.ok === false ? '`FAIL`' : '`SKIP`'} (${status.build.note})`,
    `- strict real integration: ${status.strictReal.ok === true ? '`PASS`' : status.strictReal.ok === false ? '`FAIL`' : '`SKIP`'} (${status.strictReal.note})`,
    '',
    '## Metrics',
    `- lint totals: ${lintTotals ? `errors=${lintTotals.errors}, warnings=${lintTotals.warnings}, problems=${lintTotals.problems}` : 'unavailable'}`,
    `- strict integration summary: ${integration ? `${integration.passed}/${integration.total} pass, failed=${integration.failed}` : 'unavailable'}`,
    '',
    '## Source Artifacts',
    '- `/tmp/eslint-report-current.json`',
    '- `/tmp/api-test-results.json`',
  ].join('\n');

  writeFileSync(outPath, markdown, 'utf8');
  console.log(`[release-snapshot] Wrote ${outPath}`);

  const signoffValidation = validateSignoffLinks(candidateId, outPath);
  if (signoffValidation.ok) {
    console.log(
      `[release-snapshot] Signoff links validated in ${signoffValidation.signoffPath}`,
    );
  } else {
    console.error(
      `[release-snapshot] Signoff validation failed: ${signoffValidation.message}`,
    );
    process.exit(1);
  }

  if (status.ciQuality.ok === false || status.build.ok === false || status.strictReal.ok === false) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[release-snapshot] Failed:', error.message);
  process.exit(1);
});
