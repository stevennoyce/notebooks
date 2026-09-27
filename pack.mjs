#!/usr/bin/env node
// Packs one Obsidian vault into an encrypted bundle for the Notebooks site.
//
//   SITE_PASSPHRASE=... node pack.mjs --vault <vault dir> --out <notebooks dir>
//
// Reads <vault>/site.json, collects the vault's Markdown notes (plus any tool
// pages it lists), gzips the lot as JSON, encrypts it with AES-256-GCM using a
// key derived from SITE_PASSPHRASE (PBKDF2-SHA256), and writes
// <out>/<id>/vault.bin. It also upserts the project's public card
// (title, emoji, tagline, colors) into <out>/projects.json.
//
// No dependencies: Node 20+ only. The browser side lives in index.html and
// must use the same SALT / ITERATIONS / MAGIC.

import { createHash, webcrypto } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const SALT = 'notebooks-v1';
const ITERATIONS = 600000;
const MAGIC = 'NBK1';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || !process.argv[i + 1]) {
    console.error(`usage: SITE_PASSPHRASE=... node pack.mjs --vault <dir> --out <dir>  (missing --${name})`);
    process.exit(2);
  }
  return process.argv[i + 1];
}

const vault = arg('vault');
const out = arg('out');
const pass = process.env.SITE_PASSPHRASE;
if (!pass) {
  console.error('SITE_PASSPHRASE is not set.');
  process.exit(2);
}

const cfg = JSON.parse(readFileSync(join(vault, 'site.json'), 'utf8'));
const exclude = (cfg.exclude || []).map((p) => p.replace(/\\/g, '/'));
const isExcluded = (rel) =>
  exclude.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));

// ---- notes ---------------------------------------------------------------
function walk(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const full = join(dir, ent.name);
    const rel = relative(vault, full).split(sep).join('/');
    if (ent.isDirectory()) {
      if (!isExcluded(rel + '/')) walk(full, acc);
    } else if (ent.name.endsWith('.md') && !isExcluded(rel)) {
      acc.push(rel);
    }
  }
  return acc;
}

const notes = walk(vault)
  .sort()
  .map((rel) => ({ path: rel.slice(0, -3), md: readFileSync(join(vault, rel), 'utf8') }));

// ---- tools (self-contained HTML pages, or a calendar subscribe card) ------
const tools = (cfg.tools || []).map((t) => {
  const tool = { id: t.id, title: t.title, icon: t.icon || '🧰', blurb: t.blurb || '' };
  if (t.ics) {
    tool.ics = t.ics;
    return tool;
  }
  let html = readFileSync(join(vault, t.html), 'utf8');
  for (const [src, file] of Object.entries(t.inline || {})) {
    const re = new RegExp(`<script[^>]*\\ssrc="${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>\\s*</script>`);
    const path = join(vault, file);
    const js = existsSync(path) ? readFileSync(path, 'utf8').replace(/<\/script/gi, '<\\/script') : '';
    if (!re.test(html)) console.warn(`warning: ${t.html} has no <script src="${src}">`);
    html = html.replace(re, () => `<script>\n${js}\n</script>`);
  }
  tool.html = html;
  return tool;
});

// ---- bundle + encrypt ----------------------------------------------------
let built;
try {
  built = execSync('git log -1 --format=%cI', { cwd: vault, encoding: 'utf8' }).trim();
} catch {
  built = new Date().toISOString();
}

const bundle = {
  id: cfg.id,
  title: cfg.title,
  emoji: cfg.emoji,
  home: cfg.home || 'Home',
  folderOrder: cfg.folderOrder || [],
  folderIcons: cfg.folderIcons || {},
  codeLinks: cfg.codeLinks || {},
  built,
  notes,
  tools,
};

const json = Buffer.from(JSON.stringify(bundle), 'utf8');
const gz = gzipSync(json, { level: 9 });
// Deterministic IV (hash of the plaintext): identical content gives an
// identical file, so git only sees a change when a note really changed.
const iv = createHash('sha256').update(cfg.id).update(gz).digest().subarray(0, 12);

const { subtle } = webcrypto;
const base = await subtle.importKey('raw', Buffer.from(pass, 'utf8'), 'PBKDF2', false, ['deriveKey']);
const key = await subtle.deriveKey(
  { name: 'PBKDF2', salt: Buffer.from(SALT, 'utf8'), iterations: ITERATIONS, hash: 'SHA-256' },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const ct = Buffer.from(await subtle.encrypt({ name: 'AES-GCM', iv }, key, gz));

mkdirSync(join(out, cfg.id), { recursive: true });
writeFileSync(join(out, cfg.id, 'vault.bin'), Buffer.concat([Buffer.from(MAGIC), iv, ct]));

// ---- public project card -------------------------------------------------
const listPath = join(out, 'projects.json');
const list = existsSync(listPath) ? JSON.parse(readFileSync(listPath, 'utf8')) : [];
const card = {
  id: cfg.id,
  title: cfg.title,
  emoji: cfg.emoji,
  tagline: cfg.tagline || '',
  accent: cfg.accent || '#c0395f',
  accentDark: cfg.accentDark || cfg.accent || '#f0789d',
  order: cfg.order ?? 99,
  built,
};
const merged = [...list.filter((p) => p.id !== cfg.id), card].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
writeFileSync(listPath, JSON.stringify(merged, null, 2) + '\n');

console.log(`packed ${cfg.id}: ${notes.length} notes, ${tools.length} tools, ${(ct.length / 1024).toFixed(0)} KB encrypted`);
