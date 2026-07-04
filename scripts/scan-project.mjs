#!/usr/bin/env node
// scan-project.mjs
// Scan a project repo and generate a .portfolio.md descriptor.
//
//   node scripts/scan-project.mjs <repo-path>          # preview to stdout
//   node scripts/scan-project.mjs <repo-path> --write  # write .portfolio.md into repo
//
// Auto-detects:
//   - title: from package.json name, Cargo.toml, go.mod, or directory name
//   - stack: from config files (package.json deps, Cargo.toml, go.mod, etc.)
//   - repo:  from git remote origin URL
//   - tagline + body: from README.md first paragraph
//
// Zero dependencies — Node built-ins only.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';

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

function tryRead(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function yamlScalar(v) {
  const needs = /^[\s>|@`%&*!?#\[\]{},'"]/.test(v) || /:\s|\s#/.test(v) || v === '';
  if (!needs) return v;
  return `"${v.replace(/"/g, '\\"')}"`;
}

// --- stack detection --------------------------------------------------------

const STACK_RULES = [
  // JavaScript / TypeScript
  { match: (deps, devDeps) => deps.next || devDeps.next, stack: 'Next.js' },
  { match: (deps, devDeps) => deps.nuxt || devDeps.nuxt, stack: 'Nuxt' },
  { match: (deps, devDeps) => deps.svelte || devDeps.svelte, stack: 'Svelte' },
  { match: (deps, devDeps) => deps.vue || devDeps.vue, stack: 'Vue' },
  { match: (deps, devDeps) => deps.react || devDeps.react, stack: 'React' },
  { match: (deps, devDeps) => deps.astro || devDeps.astro, stack: 'Astro' },
  { match: (deps, devDeps) => deps.express, stack: 'Express' },
  { match: (deps, devDeps) => deps.fastify, stack: 'Fastify' },
  { match: (deps, devDeps) => deps.hono, stack: 'Hono' },
  { match: (deps, devDeps) => deps.sveltekit || devDeps['@sveltejs/kit'], stack: 'SvelteKit' },
  {
    match: (_, devDeps) => devDeps.typescript || devDeps.tsx || devDeps['ts-node'],
    stack: 'TypeScript',
  },
  {
    match: (deps, devDeps) => devDeps.vite || deps.vite,
    stack: 'Vite',
  },
  // Go
  { match: () => false, stack: 'Go', file: 'go.mod' },
  // Rust
  { match: () => false, stack: 'Rust', file: 'Cargo.toml' },
  // Python
  { match: () => false, stack: 'Python', file: 'pyproject.toml' },
  { match: () => false, stack: 'Python', file: 'setup.py' },
  { match: () => false, stack: 'Python', file: 'requirements.txt' },
  // Elixir
  { match: () => false, stack: 'Elixir', file: 'mix.exs' },
  // Swift
  { match: () => false, stack: 'Swift', file: 'Package.swift' },
  { match: () => false, stack: 'Swift', glob: '*.xcodeproj' },
  // Kotlin
  { match: () => false, stack: 'Kotlin', file: 'build.gradle.kts' },
  { match: () => false, stack: 'Kotlin', file: 'build.gradle' },
  // Docker
  { match: () => false, stack: 'Docker', file: 'Dockerfile' },
  // Tailwind
  {
    match: (deps, devDeps) => deps.tailwindcss || devDeps.tailwindcss,
    stack: 'Tailwind',
  },
];

function detectStack(repoPath) {
  const stack = [];

  // Check package.json
  const pkgRaw = tryRead(join(repoPath, 'package.json'));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      for (const rule of STACK_RULES) {
        if (rule.file || rule.glob) continue;
        if (rule.match(deps, devDeps)) stack.push(rule.stack);
      }
      // Detect plain JS if nothing else
      if (
        stack.length === 0 &&
        (pkg.type === 'module' || Object.keys(deps).length > 0)
      ) {
        stack.push('JavaScript');
      }
    } catch {
      // malformed package.json, skip
    }
  }

  // Check file-based stacks
  for (const rule of STACK_RULES) {
    if (!rule.file && !rule.glob) continue;
    if (stack.includes(rule.stack)) continue;
    if (rule.file && existsSync(join(repoPath, rule.file))) stack.push(rule.stack);
  }

  // CLI tools — check if it has a bin entry or "cli" in the name
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      if (pkg.bin || basename(repoPath).includes('cli')) {
        stack.push('CLI');
      }
    } catch {
      // ignore
    }
  }
  if (existsSync(join(repoPath, 'Cargo.toml'))) {
    const cargo = tryRead(join(repoPath, 'Cargo.toml'));
    if (cargo && /\[\[bin\]\]/.test(cargo)) stack.push('CLI');
  }

  // iOS / Android heuristics
  if (existsSync(join(repoPath, 'Info.plist')) || existsSync(join(repoPath, '*.xcodeproj'))) {
    if (!stack.includes('Swift')) stack.push('iOS');
  }
  if (existsSync(join(repoPath, 'AndroidManifest.xml'))) {
    if (!stack.includes('Kotlin')) stack.push('Android');
  }

  return [...new Set(stack)];
}

// --- repo URL detection -----------------------------------------------------

function detectRepo(repoPath) {
  // Check git remote
  const output = tryRead(join(repoPath, '.git', 'config'));
  if (output) {
    const m = output.match(/url\s*=\s*(?:git@github\.com:|https:\/\/github\.com\/)([^/]+\/[^/.]+)/);
    if (m) return `https://github.com/${m[1].replace(/\.git$/, '')}`;
  }
  // Check package.json
  const pkgRaw = tryRead(join(repoPath, 'package.json'));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      if (pkg.repository?.url) return pkg.repository.url;
      if (pkg.homepage) return pkg.homepage;
    } catch {
      // ignore
    }
  }
  return null;
}

// --- title detection --------------------------------------------------------

function detectTitle(repoPath) {
  // package.json name
  const pkgRaw = tryRead(join(repoPath, 'package.json'));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      if (pkg.name) {
        // e.g. "@kaitodroid/pomotron" -> "Pomotron"
        const raw = pkg.name.split('/').pop();
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      }
    } catch {
      // ignore
    }
  }
  // Cargo.toml
  const cargoRaw = tryRead(join(repoPath, 'Cargo.toml'));
  if (cargoRaw) {
    const m = cargoRaw.match(/^name\s*=\s*"(.+)"$/m);
    if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1);
  }
  // go.mod
  const goRaw = tryRead(join(repoPath, 'go.mod'));
  if (goRaw) {
    const m = goRaw.match(/^module\s+(.+)$/m);
    if (m) {
      const parts = m[1].split('/');
      return parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
    }
  }
  // Directory name fallback
  return basename(repoPath).charAt(0).toUpperCase() + basename(repoPath).slice(1);
}

// --- README parsing ---------------------------------------------------------

function detectTaglineAndBody(repoPath) {
  for (const name of ['README.md', 'readme.md', 'README.rst', 'README']) {
    const raw = tryRead(join(repoPath, name));
    if (!raw) continue;

    const lines = raw.split(/\r?\n/);
    // Skip title line (usually "# ProjectName")
    let start = 0;
    if (lines[0]?.startsWith('#')) start = 1;

    // Skip blank lines after heading
    while (start < lines.length && lines[start].trim() === '') start++;

    // Collect non-empty lines until a blank line = first paragraph
    const taglineLines = [];
    for (let i = start; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') break;
      if (line.startsWith('#')) break;
      taglineLines.push(line);
    }
    const fullTagline = taglineLines.join(' ').replace(/\s+/g, ' ').trim();
    // Use first sentence as tagline (up to ~80 chars)
    const sentenceMatch = fullTagline.match(/^(.+?[.!?])\s/);
    const tagline =
      sentenceMatch && sentenceMatch[1].length <= 80
        ? sentenceMatch[1]
        : fullTagline.length > 80
          ? fullTagline.slice(0, 77).replace(/\s+\S*$/, '') + '...'
          : fullTagline;

    // Collect everything after the first paragraph as body
    // First, skip past the first paragraph we already consumed for tagline
    let bodyStart = start;
    // skip first paragraph lines
    while (bodyStart < lines.length && lines[bodyStart].trim() !== '') bodyStart++;
    // skip blank line(s)
    while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++;

    const bodyLines = [];
    for (let i = bodyStart; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      // Skip standalone markdown headings but keep their text
      if (/^#{1,6}\s+/.test(trimmed)) {
        bodyLines.push(trimmed.replace(/^#{1,6}\s+/, ''));
        continue;
      }
      bodyLines.push(line);
    }
    const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

    return { tagline: tagline || 'one-line description', body: body || 'Long-form copy goes here.' };
  }

  return { tagline: 'one-line description', body: 'Long-form copy goes here.' };
}

// --- git init check ---------------------------------------------------------

function isGitRepo(repoPath) {
  return existsSync(join(repoPath, '.git'));
}

// --- main -------------------------------------------------------------------

const args = process.argv.slice(2);
const writeMode = args.includes('--write');
const targetPath = args.filter((a) => !a.startsWith('--'))[0];

if (!targetPath) {
  die('usage: scan-project.mjs <repo-path> [--write]');
}

const repoPath = resolve(targetPath);
if (!existsSync(repoPath)) die(`path does not exist: ${repoPath}`);

const title = detectTitle(repoPath);
const stack = detectStack(repoPath);
const repo = detectRepo(repoPath);
const { tagline, body } = detectTaglineAndBody(repoPath);

const warnings = [];
if (stack.length === 0) warnings.push('stack: no tech detected — edit after writing');
if (!repo) warnings.push('repo:  no git remote found');
if (tagline === 'one-line description') warnings.push('tagline: no README found — write your own');
if (body === 'Long-form copy goes here.') warnings.push('body: no README found — write your own');

// Build descriptor — use placeholder stack if empty so sync validation passes
const displayStack = stack.length > 0 ? stack : ['TBD'];
const fm = [
  `title: ${yamlScalar(title)}`,
  `tagline: ${yamlScalar(tagline)}`,
  `status: in-progress`,
  `stack: [${displayStack.join(', ')}]`,
];
if (repo) fm.push(`repo: ${repo}`);

const descriptor = `---\n${fm.join('\n')}\n---\n\n${body}\n`;

if (writeMode) {
  const dest = join(repoPath, '.portfolio.md');
  if (existsSync(dest)) {
    console.log(c.yellow(`⚠ .portfolio.md already exists at ${dest}`));
    console.log(c.dim('  overwrite? edit the file manually or delete it first'));
    process.exit(1);
  }
  writeFileSync(dest, descriptor);
  console.log(c.green(`✓ wrote ${dest}`));
  if (warnings.length) {
    console.log(c.yellow('\n  needs manual edits:'));
    for (const w of warnings) console.log(c.yellow(`    • ${w}`));
  }
  console.log(c.dim(`\n  add "${targetPath}" to portfolio.repos.json, then npm run sync`));
} else {
  console.log(descriptor);
  console.log(c.dim('---'));
  console.log(c.dim(`  title:   ${title}`));
  console.log(c.dim(`  stack:   ${stack.join(', ') || '(none — will write [TBD])'}`));
  console.log(c.dim(`  repo:    ${repo || '(none detected)'}`));
  console.log(c.dim(`  tagline: ${tagline}`));
  if (warnings.length) {
    console.log(c.yellow('\n  warnings:'));
    for (const w of warnings) console.log(c.yellow(`    • ${w}`));
  }
  console.log(c.dim(`\n  run with --write to save as .portfolio.md`));
}
