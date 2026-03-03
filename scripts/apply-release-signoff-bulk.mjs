import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected']);

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

function escapeCell(value) {
  return String(value || '').replaceAll('|', '\\|').replaceAll('`', '').trim();
}

function parseApprovalLine(line) {
  if (!line.trim().startsWith('|')) return null;
  if (line.includes('|---')) return null;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cleanCell(cell));
  if (cells.length < 6) return null;
  return {
    function: cells[0],
    owner: cells[1],
    status: cells[2].toLowerCase(),
    approvedBy: cells[3],
    approvedAt: cells[4],
    notes: cells[5],
  };
}

function buildApprovalLine(row) {
  return `| ${row.function} | \`${row.owner}\` | \`${row.status}\` | ${row.approvedBy} | ${row.approvedAt} | ${row.notes} |`;
}

function applyDecision(lines, decision, version, deploymentWindow) {
  let changed = 0;
  if (decision) {
    const idx = lines.findIndex((line) => line.startsWith('- Decision: '));
    if (idx >= 0) {
      lines[idx] = `- Decision: \`${escapeCell(decision)}\``;
      changed += 1;
    }
  }
  if (version) {
    const idx = lines.findIndex((line) => line.startsWith('- Effective release tag/version: '));
    if (idx >= 0) {
      lines[idx] = `- Effective release tag/version: \`${escapeCell(version)}\``;
      changed += 1;
    }
  }
  if (deploymentWindow) {
    const idx = lines.findIndex((line) => line.startsWith('- Deployment window: '));
    if (idx >= 0) {
      lines[idx] = `- Deployment window: \`${escapeCell(deploymentWindow)}\``;
      changed += 1;
    }
  }
  return changed;
}

function applyChecklist(lines, checked) {
  let inChecklist = false;
  let changed = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!inChecklist && line.trim() === '## Approval Checklist') {
      inChecklist = true;
      continue;
    }
    if (!inChecklist) continue;
    if (line.startsWith('## ')) break;
    if (line.trim().startsWith('- [ ] ') && checked) {
      lines[i] = line.replace('- [ ] ', '- [x] ');
      changed += 1;
    } else if (line.trim().startsWith('- [x] ') && !checked) {
      lines[i] = line.replace('- [x] ', '- [ ] ');
      changed += 1;
    }
  }
  return changed;
}

function main() {
  const candidateId = process.env.RELEASE_CANDIDATE_ID || 'RC-2026-03-02-01';
  const slug = toSlug(candidateId);
  const signoffPath =
    process.env.RELEASE_SIGNOFF_PATH || path.join('docs', `release-signoff-${slug}.md`);
  const payloadPath = process.env.RELEASE_BULK_PAYLOAD_PATH;
  const apply = envBool('APPLY_SIGNOFF_UPDATE', false);

  if (!payloadPath) {
    throw new Error('RELEASE_BULK_PAYLOAD_PATH is required.');
  }
  if (!existsSync(signoffPath)) {
    throw new Error(`Signoff file not found: ${signoffPath}`);
  }
  if (!existsSync(payloadPath)) {
    throw new Error(`Bulk payload file not found: ${payloadPath}`);
  }

  const payload = JSON.parse(readFileSync(payloadPath, 'utf8'));
  const approvalUpdates = Array.isArray(payload.approvals) ? payload.approvals : [];
  const decision = payload.decision || null;
  const checklistComplete = payload.checklistComplete;

  const markdown = readFileSync(signoffPath, 'utf8');
  const lines = markdown.split('\n');

  let inTable = false;
  let approvalChanged = 0;
  let decisionChanged = 0;
  let checklistChanged = 0;

  const indexByFunction = new Map(
    approvalUpdates.map((update, idx) => [String(update.function || '').trim(), idx]),
  );
  const appliedFunctions = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!inTable) {
      if (line.includes('| Function | Owner | Status | Approved By | Approved At (UTC) | Notes |')) {
        inTable = true;
      }
      continue;
    }
    if (!line.trim().startsWith('|')) break;

    const parsed = parseApprovalLine(line);
    if (!parsed) continue;
    if (!indexByFunction.has(parsed.function)) continue;

    const update = approvalUpdates[indexByFunction.get(parsed.function)];
    const nextStatus = String(update.status || parsed.status).trim().toLowerCase();
    if (!ALLOWED_STATUSES.has(nextStatus)) {
      throw new Error(
        `Invalid status for ${parsed.function}: ${nextStatus}. Allowed: pending, approved, rejected.`,
      );
    }

    const nextApprovedBy =
      nextStatus === 'approved' ? escapeCell(update.approvedBy || parsed.approvedBy) : '';
    const nextApprovedAt =
      nextStatus === 'approved'
        ? escapeCell(
            update.approvedAt ||
              parsed.approvedAt ||
              new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          )
        : '';
    if (nextStatus === 'approved' && !nextApprovedBy) {
      throw new Error(`approvedBy is required for approved status on ${parsed.function}`);
    }

    const nextNotes = escapeCell(update.notes ?? parsed.notes);
    lines[i] = buildApprovalLine({
      function: parsed.function,
      owner: parsed.owner,
      status: nextStatus,
      approvedBy: nextApprovedBy,
      approvedAt: nextApprovedAt,
      notes: nextNotes,
    });
    approvalChanged += 1;
    appliedFunctions.add(parsed.function);
  }

  for (const update of approvalUpdates) {
    const fn = String(update.function || '').trim();
    if (fn && !appliedFunctions.has(fn)) {
      throw new Error(`Approval row not found for function: ${fn}`);
    }
  }

  if (decision && typeof decision === 'object') {
    decisionChanged += applyDecision(
      lines,
      decision.finalDecision,
      decision.effectiveVersion,
      decision.deploymentWindow,
    );
  }

  if (typeof checklistComplete === 'boolean') {
    checklistChanged += applyChecklist(lines, checklistComplete);
  }

  if (approvalChanged + decisionChanged + checklistChanged === 0) {
    throw new Error('No changes were generated from payload.');
  }

  const nextMarkdown = lines.join('\n');
  if (apply) {
    writeFileSync(signoffPath, nextMarkdown, 'utf8');
    console.log(
      `[signoff-bulk] Applied updates in ${signoffPath} (approvals=${approvalChanged}, decision=${decisionChanged}, checklist=${checklistChanged})`,
    );
    return;
  }

  const previewPath = `/tmp/release-signoff-bulk-preview-${slug}.md`;
  writeFileSync(previewPath, nextMarkdown, 'utf8');
  console.log(
    `[signoff-bulk] Dry-run complete. Preview written to ${previewPath} (approvals=${approvalChanged}, decision=${decisionChanged}, checklist=${checklistChanged})`,
  );
  console.log('[signoff-bulk] Set APPLY_SIGNOFF_UPDATE=true to write changes to the signoff packet.');
}

try {
  main();
} catch (error) {
  console.error('[signoff-bulk] Failed:', error.message);
  process.exit(1);
}
