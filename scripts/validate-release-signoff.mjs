import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function envBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return TRUE_VALUES.has(String(raw).trim().toLowerCase());
}

function toSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function cleanCell(value) {
  return String(value || '')
    .replaceAll('`', '')
    .trim();
}

function parseApprovalsTable(markdown) {
  const lines = markdown.split('\n');
  const rows = [];
  let inTable = false;

  for (const line of lines) {
    if (!inTable && line.includes('| Function | Owner | Status | Approved By | Approved At (UTC) | Notes |')) {
      inTable = true;
      continue;
    }

    if (!inTable) continue;
    if (!line.trim().startsWith('|')) break;
    if (line.includes('|---')) continue;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cleanCell(cell));
    if (cells.length < 6) continue;

    rows.push({
      function: cells[0],
      owner: cells[1],
      status: cells[2].toLowerCase(),
      approvedBy: cells[3],
      approvedAt: cells[4],
      notes: cells[5],
    });
  }

  return rows;
}

function parseUncheckedChecklistCount(markdown) {
  const lines = markdown.split('\n');
  let inChecklist = false;
  let unchecked = 0;

  for (const line of lines) {
    if (!inChecklist && line.trim() === '## Approval Checklist') {
      inChecklist = true;
      continue;
    }
    if (!inChecklist) continue;
    if (line.startsWith('## ')) break;
    if (line.trim().startsWith('- [ ] ')) unchecked += 1;
  }

  return unchecked;
}

function parseFinalDecision(markdown) {
  const decisionMatch = markdown.match(/- Decision:\s*`([^`]+)`/);
  const versionMatch = markdown.match(/- Effective release tag\/version:\s*`([^`]+)`/);
  const windowMatch = markdown.match(/- Deployment window:\s*`([^`]+)`/);

  return {
    decision: decisionMatch ? decisionMatch[1].trim().toLowerCase() : 'missing',
    version: versionMatch ? versionMatch[1].trim() : 'missing',
    deploymentWindow: windowMatch ? windowMatch[1].trim() : 'missing',
  };
}

function main() {
  const candidateId = process.env.RELEASE_CANDIDATE_ID || 'RC-2026-03-02-01';
  const slug = toSlug(candidateId);
  const signoffPath =
    process.env.RELEASE_SIGNOFF_PATH || path.join('docs', `release-signoff-${slug}.md`);
  const requireApproved = envBool('REQUIRE_SIGNOFF_APPROVED', false);
  const statusOutPath =
    process.env.RELEASE_SIGNOFF_STATUS_OUTPUT || path.join('docs', `release-signoff-status-${slug}.md`);

  if (!existsSync(signoffPath)) {
    throw new Error(`Signoff file not found: ${signoffPath}`);
  }

  const markdown = readFileSync(signoffPath, 'utf8');
  const approvals = parseApprovalsTable(markdown);
  const uncheckedChecklistItems = parseUncheckedChecklistCount(markdown);
  const finalDecision = parseFinalDecision(markdown);

  const pendingApprovals = approvals.filter((row) => row.status !== 'approved');
  const incompleteApprovedFields = approvals.filter(
    (row) => row.status === 'approved' && (!row.approvedBy || !row.approvedAt),
  );

  const decisionReady =
    finalDecision.decision !== 'pending' &&
    finalDecision.decision !== 'missing' &&
    finalDecision.version !== 'pending' &&
    finalDecision.version !== 'missing' &&
    finalDecision.deploymentWindow !== 'pending' &&
    finalDecision.deploymentWindow !== 'missing';

  const readyForRelease =
    pendingApprovals.length === 0 &&
    incompleteApprovedFields.length === 0 &&
    uncheckedChecklistItems === 0 &&
    decisionReady;

  const report = [
    `# Release Signoff Status - ${candidateId}`,
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Source packet: \`${signoffPath}\``,
    `Require approved mode: \`${requireApproved ? 'true' : 'false'}\``,
    '',
    '## Approval Summary',
    `- Total approvals required: ${approvals.length}`,
    `- Pending/non-approved approvals: ${pendingApprovals.length}`,
    `- Approved rows missing approver/timestamp: ${incompleteApprovedFields.length}`,
    '',
    '## Checklist & Decision',
    `- Unchecked approval checklist items: ${uncheckedChecklistItems}`,
    `- Final decision: ${finalDecision.decision}`,
    `- Effective release tag/version: ${finalDecision.version}`,
    `- Deployment window: ${finalDecision.deploymentWindow}`,
    '',
    `Ready for release: ${readyForRelease ? 'YES' : 'NO'}`,
  ].join('\n');

  writeFileSync(statusOutPath, report, 'utf8');
  console.log(`[release-signoff] Wrote ${statusOutPath}`);
  console.log(`[release-signoff] Ready for release: ${readyForRelease ? 'YES' : 'NO'}`);

  if (requireApproved && !readyForRelease) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error('[release-signoff] Failed:', error.message);
  process.exit(1);
}
