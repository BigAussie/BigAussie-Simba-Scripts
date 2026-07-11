#!/usr/bin/env node
/**
 * Builds catalog.json from descriptions/*.md
 *
 * Edit the markdown files (with optional YAML frontmatter), then run:
 *   node build-catalog.mjs
 *   or double-click Build Catalog.bat
 *
 * Frontmatter example:
 * ---
 * path: Barronite Miner.simba
 * type: free
 * activities: [mining]
 * ---
 *
 * ### Barronite Miner
 * Your description in normal markdown...
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DESC_DIR = join(ROOT, 'descriptions');
const OUT = join(ROOT, 'catalog.json');

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function parseFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { meta: {}, body: normalized.trim() };
  }
  const end = normalized.indexOf('\n---\n', 4);
  if (end < 0) {
    return { meta: {}, body: normalized.trim() };
  }
  const raw = normalized.slice(4, end);
  const body = normalized.slice(end + 5).trim();
  const meta = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key === 'activities') {
      const inner = val.replace(/^\[/, '').replace(/\]$/, '').trim();
      meta.activities = inner
        ? inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
        : [];
    } else {
      meta[key] = val;
    }
  }
  return { meta, body };
}

function defaultPathFromMd(mdFile) {
  const rel = relative(DESC_DIR, mdFile).replace(/\\/g, '/');
  return rel.replace(/\.md$/i, '.simba');
}

const scripts = [];
for (const mdFile of walk(DESC_DIR)) {
  const text = readFileSync(mdFile, 'utf8');
  const { meta, body } = parseFrontmatter(text);
  const scriptPath = meta.path || defaultPathFromMd(mdFile);
  if (!body) {
    console.warn('Skipping empty description:', relative(ROOT, mdFile));
    continue;
  }
  scripts.push({
    path: scriptPath,
    type: meta.type || 'free',
    activities: Array.isArray(meta.activities) ? meta.activities : [],
    description: body,
  });
}

scripts.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }));

const catalog = { scripts };
writeFileSync(OUT, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log(`Wrote ${scripts.length} script(s) -> catalog.json`);
for (const s of scripts) {
  console.log(`  - ${s.path} (${(s.activities || []).join(', ') || 'no activities'})`);
}
