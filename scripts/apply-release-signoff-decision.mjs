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

function escapeInline(value) {
  return String(value || '').replaceAll('`', '').trim();
}

function replaceLine(lines, prefix, nextValue) {
  const index = lines.findIndex((line) => line.startsWith(prefix));
  if (index < 0) return false;
  lines[index] = `${prefix}\`${escapeInline(nextValue)}\``;
  return true;
}

function applyChecklist(lines, checked) {
  let inChecklist = false;
  let touched = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!inChecklist && line.trim() === '## Approval Checklist') {
      inChecklist = true;
      continue;
    }
    if (!inChecklist) continue;
    if (line.startsWith('## ')) break;
    if (line.trim().startsWith('- [ ] ')) {
      lines[i] = line.replace('- [ ] ', checked ? '- [x] ' : '- [ ] ');
      touched += 1;
    } else if (line.trim().startsWith('- [x] ')) {
      lines[i] = line.replace('- [x] ', checked ? '- [x] ' : '- [ ] ');
      touched += 1;
    }
  }

  return touched;
}

function main() {
  const candidateId = process.env.RELEASE_CANDIDATE_ID || 'RC-2026-03-02-01';
  const slug = toSlug(candidateId);
  const signoffPath =
    process.env.RELEASE_SIGNOFF_PATH || path.join('docs', `release-signoff-${slug}.md`);
  const apply = envBool('APPLY_SIGNOFF_UPDATE', false);
  const markChecklistChecked = envBool('RELEASE_MARK_CHECKLIST_COMPLETE', false);

  const decision = process.env.RELEASE_FINAL_DECISION;
  const version = process.env.RELEASE_EFFECTIVE_VERSION;
  const deploymentWindow = process.env.RELEASE_DEPLOYMENT_WINDOW;

  if (!existsSync(signoffPath)) {
    throw new Error(`Signoff file not found: ${signoffPath}`);
  }

  if (!decision && !version && !deploymentWindow && !markChecklistChecked) {
    throw new Error(
      'Provide at least one update: RELEASE_FINAL_DECISION, RELEASE_EFFECTIVE_VERSION, RELEASE_DEPLOYMENT_WINDOW, or RELEASE_MARK_CHECKLIST_COMPLETE=true.',
    );
  }

  const markdown = readFileSync(signoffPath, 'utf8');
  const lines = markdown.split('\n');
  let changed = 0;

  if (markChecklistChecked) {
    const touched = applyChecklist(lines, true);
    changed += touched;
  }

  if (decision && replaceLine(lines, '- Decision: ', decision)) changed += 1;
  if (version && replaceLine(lines, '- Effective release tag/version: ', version)) changed += 1;
  if (deploymentWindow && replaceLine(lines, '- Deployment window: ', deploymentWindow)) changed += 1;

  if (changed === 0) {
    throw new Error('No matching signoff fields were updated. Check packet format and input values.');
  }

  const nextMarkdown = lines.join('\n');
  if (apply) {
    writeFileSync(signoffPath, nextMarkdown, 'utf8');
    console.log(`[signoff-decision] Updated ${changed} field(s) in ${signoffPath}`);
    return;
  }

  const previewPath = `/tmp/release-signoff-decision-preview-${slug}.md`;
  writeFileSync(previewPath, nextMarkdown, 'utf8');
  console.log(`[signoff-decision] Dry-run complete. Preview written to ${previewPath}`);
  console.log('[signoff-decision] Set APPLY_SIGNOFF_UPDATE=true to write changes to the signoff packet.');
}

try {
  main();
} catch (error) {
  console.error('[signoff-decision] Failed:', error.message);
  process.exit(1);
}
