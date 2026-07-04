#!/usr/bin/env node
// sync-projects.mjs
// Mirror per-repo `.portfolio.md` descriptors into src/content/projects/.
//
// Each project repo declares its portfolio metadata in a `.portfolio.md` file
// (YAML frontmatter matching the Astro schema + body = "THE IDEA" copy).
// `portfolio.repos.json` lists which repos to import; array order = grid order.
//
//   node scripts/sync-projects.mjs            # add + update
//   node scripts/sync-projects.mjs --prune    # also delete orphaned projects
//   node scripts/sync-projects.mjs --dry-run  # report only, write nothing
//   node scripts/sync-projects.mjs init <repo-path>   # scaffold a .portfolio.md
//
// Zero dependencies — Node built-ins only. The authoritative validation is
// still `astro build` (runs src/content.config.ts over the generated files).

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  unlinkSync,
  mkdirSync,
} from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const PROJECTS_DIR = join(ROOT, 'src', 'content', 'projects');
const CONFIG_PATH = join(ROOT, 'portfolio.repos.json');
const DESCRIPTOR = '.portfolio.md';

const STATUSES = ['idea', 'in-progress', 'active', 'archive'];

// --- tiny console helpers ---------------------------------------------------
const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function die(msg) {
  console.error(c.red(`✗ ${msg}`));
  process.exit(1);
}

// --- frontmatter parsing (line-based, controlled field set) -----------------
function unquote(v) {
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

// Strip a trailing ` # comment` only on unquoted values. URLs use `#fragment`
// with no preceding space, so they survive.
function stripComment(v) {
  if (v.startsWith('"') || v.startsWith("'")) return v;
  return v.replace(/\s+#.*$/, '');
}

function parseDescriptor(raw, label) {
  const lines = raw.split(/\r?\n/);
  if (lines[0].trim() !== '---') {
    throw new Error(`${label}: missing opening '---' frontmatter fence`);
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error(`${label}: unterminated frontmatter`);

  const data = {};
  for (const line of lines.slice(1, end)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = stripComment(m[2].trim()).trim();
    if (key === 'stack' || key === 'shots') {
      val = val.replace(/^\[/, '').replace(/\]$/, '');
      data[key] = val
        .split(',')
        .map((s) => unquote(s.trim()))
        .filter(Boolean);
    } else {
      data[key] = unquote(val);
    }
  }

  const body = lines
    .slice(end + 1)
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\s+$/, '');
  return { data, body };
}

function validate(data, label) {
  const errs = [];
  if (!data.title) errs.push('missing `title`');
  if (!data.tagline) errs.push('missing `tagline`');
  if (!data.status) errs.push('missing `status`');
  else if (!STATUSES.includes(data.status))
    errs.push(`status must be ${STATUSES.join('|')} (got "${data.status}")`);
  if (!data.stack || data.stack.length === 0) errs.push('`stack` is empty');
  if (errs.length) throw new Error(`${label}: ${errs.join('; ')}`);
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// --- output rendering -------------------------------------------------------
// Quote a scalar only when YAML would otherwise mis-parse it.
function yamlScalar(v) {
  const needs = /^[\s>|@`%&*!?#\[\]{},'"]/.test(v) || /:\s|\s#/.test(v) || v === '';
  if (!needs) return v;
  return `"${v.replace(/"/g, '\\"')}"`;
}

function render(data, order) {
  const fm = [
    `title: ${yamlScalar(data.title)}`,
    `tagline: ${yamlScalar(data.tagline)}`,
    `status: ${data.status}`,
    `stack: [${data.stack.join(', ')}]`,
  ];
  if (data.landing) fm.push(`landing: ${data.landing}`);
  if (data.repo) fm.push(`repo: ${data.repo}`);
  if (data.demo) fm.push(`demo: ${data.demo}`);
  if (data.shots && data.shots.length) fm.push(`shots: [${data.shots.join(', ')}]`);
  fm.push(`order: ${order}`);
  return `---\n${fm.join('\n')}\n---\n\n${data.body}\n`;
}

// --- config -----------------------------------------------------------------
function loadRepos() {
  if (!existsSync(CONFIG_PATH)) {
    die(`config not found: ${CONFIG_PATH}\n  create it with { "repos": ["../my-project"] }`);
  }
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    die(`could not parse portfolio.repos.json: ${e.message}`);
  }
  if (!Array.isArray(cfg.repos)) die('portfolio.repos.json must have a "repos" array');
  return cfg.repos.map((entry) => (typeof entry === 'string' ? entry : entry.path));
}

// --- init subcommand --------------------------------------------------------
const TEMPLATE = `---
title: My Project
tagline: one-line description shown on the card
status: in-progress
stack: [Tech, Stack]
# landing: https://example.com
# repo: https://github.com/you/project
# slug: custom-slug
---

Long-form "THE IDEA" copy goes here. Write as many paragraphs as you like;
\`inline code\` is styled on the detail page.
`;

function runInit(targetArg) {
  if (!targetArg) die('usage: sync-projects.mjs init <repo-path>');
  const repoPath = resolve(ROOT, targetArg);
  if (!existsSync(repoPath)) die(`path does not exist: ${repoPath}`);
  const dest = join(repoPath, DESCRIPTOR);
  if (existsSync(dest)) die(`${DESCRIPTOR} already exists at ${dest}`);
  writeFileSync(dest, TEMPLATE);
  console.log(c.green(`✓ wrote ${dest}`));
  console.log(c.dim(`  fill it in, add "${targetArg}" to portfolio.repos.json, then npm run sync`));
}

// --- sync -------------------------------------------------------------------
function runSync({ prune, dryRun }) {
  const repos = loadRepos();
  const produced = []; // { slug, content, repoLabel }
  const skipped = []; // { repoLabel, reason }
  const slugSeen = new Map();

  repos.forEach((repoEntry, idx) => {
    const repoPath = resolve(ROOT, repoEntry);
    const repoLabel = repoEntry;
    const descPath = join(repoPath, DESCRIPTOR);
    if (!existsSync(descPath)) {
      skipped.push({ repoLabel, reason: `no ${DESCRIPTOR}` });
      return;
    }
    let parsed;
    try {
      parsed = parseDescriptor(readFileSync(descPath, 'utf8'), repoLabel);
      validate(parsed.data, repoLabel);
    } catch (e) {
      skipped.push({ repoLabel, reason: e.message.replace(`${repoLabel}: `, '') });
      return;
    }
    const data = { ...parsed.data, body: parsed.body };
    const slug = data.slug ? slugify(data.slug) : slugify(basename(repoPath));
    if (slugSeen.has(slug)) {
      skipped.push({
        repoLabel,
        reason: `duplicate slug "${slug}" (also from ${slugSeen.get(slug)})`,
      });
      return;
    }
    slugSeen.set(slug, repoLabel);
    produced.push({ slug, content: render(data, idx + 1), repoLabel });
  });

  if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true });

  const existing = new Set(
    readdirSync(PROJECTS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
  );

  const added = [];
  const updated = [];
  const unchanged = [];
  const producedSlugs = new Set();

  for (const { slug, content } of produced) {
    producedSlugs.add(slug);
    const target = join(PROJECTS_DIR, `${slug}.md`);
    if (!existing.has(slug)) {
      added.push(slug);
      if (!dryRun) writeFileSync(target, content);
    } else {
      const current = readFileSync(target, 'utf8');
      if (current !== content) {
        updated.push(slug);
        if (!dryRun) writeFileSync(target, content);
      } else {
        unchanged.push(slug);
      }
    }
  }

  const orphans = [...existing].filter((s) => !producedSlugs.has(s));
  const pruned = [];
  for (const slug of orphans) {
    if (prune && !dryRun) unlinkSync(join(PROJECTS_DIR, `${slug}.md`));
    if (prune) pruned.push(slug);
  }

  // --- report ---
  console.log(c.bold(`\nProject sync${dryRun ? ' (dry run — no changes written)' : ''}\n`));
  const line = (label, items, color) =>
    items.length && console.log(`  ${color(label.padEnd(10))} ${items.join(', ')}`);
  line('added', added, c.green);
  line('updated', updated, c.yellow);
  line('unchanged', unchanged, c.dim);
  if (prune) line('pruned', pruned, c.red);
  else if (orphans.length)
    console.log(
      `  ${c.yellow('orphans'.padEnd(10))} ${orphans.join(', ')} ${c.dim('(run with --prune to remove)')}`
    );
  for (const s of skipped)
    console.log(`  ${c.red('skipped'.padEnd(10))} ${s.repoLabel} ${c.dim(`— ${s.reason}`)}`);

  console.log(
    c.dim(
      `\n  ${produced.length} imported · ${added.length} added · ${updated.length} updated · ` +
        `${unchanged.length} unchanged · ${prune ? pruned.length + ' pruned · ' : ''}${skipped.length} skipped`
    )
  );
  if (!dryRun) console.log(c.dim('  next: npm run build\n'));
  else console.log('');

  if (skipped.length) process.exitCode = 1;
}

// --- entry ------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv[0] === 'init') {
  runInit(argv[1]);
} else {
  runSync({ prune: argv.includes('--prune'), dryRun: argv.includes('--dry-run') });
}
