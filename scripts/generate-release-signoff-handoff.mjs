import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

function toSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function cleanCell(value) {
  return String(value || '')
    .replaceAll('`', '')
    .trim();
}

function parseApprovals(markdown) {
  const lines = markdown.split('\n');
  const rows = [];
  let inTable = false;

  for (const line of lines) {
    if (
      !inTable &&
      line.includes('| Function | Owner | Status | Approved By | Approved At (UTC) | Notes |')
    ) {
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

function parseChecklist(markdown) {
  const lines = markdown.split('\n');
  const items = [];
  let inChecklist = false;

  for (const line of lines) {
    if (!inChecklist && line.trim() === '## Approval Checklist') {
      inChecklist = true;
      continue;
    }
    if (!inChecklist) continue;
    if (line.startsWith('## ')) break;
    const uncheckedMatch = line.match(/^- \[ \] (.+)$/);
    const checkedMatch = line.match(/^- \[x\] (.+)$/i);
    if (uncheckedMatch) items.push({ checked: false, text: uncheckedMatch[1].trim() });
    if (checkedMatch) items.push({ checked: true, text: checkedMatch[1].trim() });
  }

  return items;
}

function parseDecision(markdown) {
  const decisionMatch = markdown.match(/- Decision:\s*`([^`]+)`/);
  const versionMatch = markdown.match(/- Effective release tag\/version:\s*`([^`]+)`/);
  const windowMatch = markdown.match(/- Deployment window:\s*`([^`]+)`/);

  return {
    decision: decisionMatch ? decisionMatch[1].trim() : 'pending',
    version: versionMatch ? versionMatch[1].trim() : 'pending',
    deploymentWindow: windowMatch ? windowMatch[1].trim() : 'pending',
  };
}

function main() {
  const candidateId = process.env.RELEASE_CANDIDATE_ID || 'RC-2026-03-02-01';
  const slug = toSlug(candidateId);
  const signoffPath =
    process.env.RELEASE_SIGNOFF_PATH || path.join('docs', `release-signoff-${slug}.md`);
  const statusPath =
    process.env.RELEASE_SIGNOFF_STATUS_PATH ||
    path.join('docs', `release-signoff-status-${slug}.md`);
  const outPath =
    process.env.RELEASE_SIGNOFF_HANDOFF_OUTPUT ||
    path.join('docs', `release-signoff-handoff-${slug}.md`);

  if (!existsSync(signoffPath)) {
    throw new Error(`Signoff file not found: ${signoffPath}`);
  }
  if (!existsSync(statusPath)) {
    throw new Error(
      `Signoff status file not found: ${statusPath}. Run "npm run release:signoff:status" first.`,
    );
  }

  const signoff = readFileSync(signoffPath, 'utf8');
  const status = readFileSync(statusPath, 'utf8');
  const approvals = parseApprovals(signoff);
  const checklist = parseChecklist(signoff);
  const decision = parseDecision(signoff);

  const pendingApprovals = approvals.filter((row) => row.status !== 'approved');
  const uncheckedChecklist = checklist.filter((item) => !item.checked);
  const readyMatch = status.match(/Ready for release:\s*(YES|NO)/i);
  const readyForRelease = readyMatch ? readyMatch[1].toUpperCase() : 'UNKNOWN';

  const doc = [
    `# Release Signoff Handoff - ${candidateId}`,
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Source packet: \`${signoffPath}\``,
    `Source status: \`${statusPath}\``,
    '',
    '## Current State',
    `- Ready for release: \`${readyForRelease}\``,
    `- Pending approvals: ${pendingApprovals.length}/${approvals.length}`,
    `- Unchecked approval checklist items: ${uncheckedChecklist.length}/${checklist.length}`,
    `- Final decision: \`${decision.decision}\``,
    `- Effective release tag/version: \`${decision.version}\``,
    `- Deployment window: \`${decision.deploymentWindow}\``,
    '',
    '## Pending Approvals',
    ...(pendingApprovals.length
      ? pendingApprovals.map(
          (row) =>
            `- ${row.function} (${row.owner}) status=\`${row.status}\` approvedBy=\`${row.approvedBy || 'pending'}\``,
        )
      : ['- none']),
    '',
    '## Unchecked Checklist Items',
    ...(uncheckedChecklist.length
      ? uncheckedChecklist.map((item) => `- ${item.text}`)
      : ['- none']),
    '',
    '## Next Commands',
    '- Approver row update (dry-run):',
    '  `RELEASE_APPROVAL_FUNCTION="Engineering" RELEASE_APPROVAL_STATUS="approved" RELEASE_APPROVED_BY="@backend" npm run release:signoff:approve`',
    '- Decision/checklist update (dry-run):',
    '  `RELEASE_FINAL_DECISION="approved" RELEASE_EFFECTIVE_VERSION="v1.0.0-rc-2026-03-02-01" RELEASE_DEPLOYMENT_WINDOW="2026-03-03 02:00-03:00 UTC" RELEASE_MARK_CHECKLIST_COMPLETE=true npm run release:signoff:decision`',
    '- Recompute status:',
    '  `npm run release:signoff:status`',
    '- Enforce gate (should pass only after real approvals):',
    '  `npm run release:signoff:gate`',
  ].join('\n');

  writeFileSync(outPath, doc, 'utf8');
  console.log(`[release-signoff-handoff] Wrote ${outPath}`);
}

try {
  main();
} catch (error) {
  console.error('[release-signoff-handoff] Failed:', error.message);
  process.exit(1);
}
