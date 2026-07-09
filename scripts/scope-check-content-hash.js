#!/usr/bin/env node
// Report-only diagnostic (no files touched): sha256-hashes the extractText() output of every
// file (the same hash manifest.json already stores) and groups by identical hash to find true
// content duplicates - regardless of filename. Cross-checks against the filename-based clusters
// from scope-check-dup-clusters.js and flags any disagreement (name-copies with different
// content, or same-content under unrelated names).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { RAW_DIR, extractText } = require('./classify-questions');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// Same conservative filename normalisation as scope-check-dup-clusters.js.
function conservativeBase(name) {
  let b = name.replace(/\.(docx?|pdf|txt)$/i, '');
  let prev;
  do {
    prev = b;
    b = b.replace(/\s*-\s*copy$/i, '');
    b = b.replace(/\s*\(\d+\)$/i, '');
    b = b.replace(/\s+$/, '');
  } while (b !== prev);
  b = b.replace(/^copy of\s+/i, '');
  return b.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function main() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .sort();

  const byHash = new Map(); // hash -> [files]
  const errored = [];
  for (const f of files) {
    let text;
    try {
      text = await extractText(path.join(RAW_DIR, f));
    } catch (err) {
      errored.push(f);
      continue;
    }
    const h = sha256(text || '');
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(f);
  }

  const hashGroups = [...byHash.values()].filter((v) => v.length > 1).sort((a, b) => b.length - a.length);
  const filesInHashGroups = hashGroups.reduce((a, v) => a + v.length, 0);

  // Filename clusters (conservative).
  const nameClusters = new Map();
  for (const f of files) {
    const k = conservativeBase(f);
    if (!nameClusters.has(k)) nameClusters.set(k, []);
    nameClusters.get(k).push(f);
  }
  const nameMulti = [...nameClusters.entries()].filter(([, v]) => v.length > 1);

  const line = (s = '') => console.log(s);
  line('='.repeat(90));
  line('CONTENT-HASH DUPLICATE GROUPS (sha256 of extractText output)');
  line('='.repeat(90));
  line(`Files scanned: ${files.length}  (errored/unreadable, excluded: ${errored.length}${errored.length ? ' - ' + errored.join(', ') : ''})`);
  line();
  line(`Content-identical groups (2+ files): ${hashGroups.length}`);
  line(`Total files in those groups: ${filesInHashGroups}`);
  line(`Redundant copies (files - groups): ${filesInHashGroups - hashGroups.length}`);
  line();
  line(`Filename-cluster count (conservative, for comparison): ${nameMulti.length} clusters / ${nameMulti.reduce((a, [, v]) => a + v.length, 0)} files`);
  line();

  line('-'.repeat(90));
  line('Content-identical groups:');
  line('-'.repeat(90));
  hashGroups.forEach((g, i) => {
    const bases = new Set(g.map(conservativeBase));
    const flag = bases.size > 1 ? '  <-- SAME CONTENT, DIFFERENT NAME-BASE' : '';
    line(`  [${g.length}] group ${i + 1}${flag}`);
    for (const f of g.sort()) line(`       ${f}`);
  });
  line();

  // Disagreement A: files that share a conservative name-base but do NOT all hash the same.
  line('-'.repeat(90));
  line('DISAGREEMENTS');
  line('-'.repeat(90));
  line('A) Name looks like a copy family, but content hashes DIFFER (not true duplicates):');
  let anyA = false;
  for (const [k, v] of nameMulti) {
    const hashes = new Set(v.map((f) => (errored.includes(f) ? 'ERR:' + f : sha256Cached(byHash, f))));
    if (hashes.size > 1) {
      anyA = true;
      line(`   name-base "${k}":`);
      for (const f of v.sort()) {
        const h = errored.includes(f) ? 'ERRORED' : sha256Cached(byHash, f).slice(0, 12);
        line(`       ${f}   [${h}]`);
      }
    }
  }
  if (!anyA) line('   (none)');
  line();
  line('B) Content identical but names are NOT a copy family (different name-base):');
  let anyB = false;
  for (const g of hashGroups) {
    const bases = new Set(g.map(conservativeBase));
    if (bases.size > 1) {
      anyB = true;
      line(`   ${g.map((f) => `"${f}"`).join('  ==  ')}`);
    }
  }
  if (!anyB) line('   (none)');
}

// Find the hash of a file from the byHash map (reverse lookup).
function sha256Cached(byHash, file) {
  for (const [h, files] of byHash) if (files.includes(file)) return h;
  return 'UNKNOWN';
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
