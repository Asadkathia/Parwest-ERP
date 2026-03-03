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

function escapeCell(value) {
  return String(value || '').replaceAll('|', '\\|').trim();
}

function buildApprovalRow(fn, owner, status, approvedBy, approvedAt, notes) {
  return `| ${fn} | \`${owner}\` | \`${status}\` | ${approvedBy} | ${approvedAt} | ${notes} |`;
}

function parseApprovalRow(line) {
  if (!line.trim().startsWith('|')) return null;
  if (line.includes('|---')) return null;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => String(cell || '').replaceAll('`', '').trim());
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

function main() {
  const candidateId = process.env.RELEASE_CANDIDATE_ID || 'RC-2026-03-02-01';
  const slug = toSlug(candidateId);
  const signoffPath =
    process.env.RELEASE_SIGNOFF_PATH || path.join('docs', `release-signoff-${slug}.md`);
  const targetFunction = String(process.env.RELEASE_APPROVAL_FUNCTION || '').trim();
  const status = String(process.env.RELEASE_APPROVAL_STATUS || 'approved').trim().toLowerCase();
  const approvedBy = String(process.env.RELEASE_APPROVED_BY || '').trim();
  const approvedAt =
    String(process.env.RELEASE_APPROVED_AT || '').trim() ||
    new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const notes = String(process.env.RELEASE_APPROVAL_NOTES || '').trim();
  const apply = envBool('APPLY_SIGNOFF_UPDATE', false);

  if (!existsSync(signoffPath)) {
    throw new Error(`Signoff file not found: ${signoffPath}`);
  }
  if (!targetFunction) {
    throw new Error('RELEASE_APPROVAL_FUNCTION is required (e.g. "Engineering").');
  }
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error('RELEASE_APPROVAL_STATUS must be one of: pending, approved, rejected.');
  }
  if (status === 'approved' && !approvedBy) {
    throw new Error('RELEASE_APPROVED_BY is required when RELEASE_APPROVAL_STATUS=approved.');
  }

  const markdown = readFileSync(signoffPath, 'utf8');
  const lines = markdown.split('\n');
  let tableStarted = false;
  let updated = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!tableStarted) {
      if (line.includes('| Function | Owner | Status | Approved By | Approved At (UTC) | Notes |')) {
        tableStarted = true;
      }
      continue;
    }

    if (!line.trim().startsWith('|')) break;
    const parsed = parseApprovalRow(line);
    if (!parsed) continue;
    if (parsed.function !== targetFunction) continue;

    const rowApprovedBy = status === 'approved' ? escapeCell(approvedBy) : '';
    const rowApprovedAt = status === 'approved' ? escapeCell(approvedAt) : '';
    const rowNotes = escapeCell(notes);
    lines[i] = buildApprovalRow(
      parsed.function,
      parsed.owner,
      status,
      rowApprovedBy,
      rowApprovedAt,
      rowNotes,
    );
    updated = true;
    break;
  }

  if (!updated) {
    throw new Error(`Approval row not found for function: ${targetFunction}`);
  }

  const nextMarkdown = lines.join('\n');
  if (apply) {
    writeFileSync(signoffPath, nextMarkdown, 'utf8');
    console.log(`[signoff-apply] Updated ${targetFunction} row in ${signoffPath}`);
    return;
  }

  const previewPath = `/tmp/release-signoff-preview-${slug}.md`;
  writeFileSync(previewPath, nextMarkdown, 'utf8');
  console.log(`[signoff-apply] Dry-run complete. Preview written to ${previewPath}`);
  console.log('[signoff-apply] Set APPLY_SIGNOFF_UPDATE=true to write changes to the signoff packet.');
}

try {
  main();
} catch (error) {
  console.error('[signoff-apply] Failed:', error.message);
  process.exit(1);
}
