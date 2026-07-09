#!/usr/bin/env node
// Report-only diagnostic (no files touched): finds filename clusters that look like the same
// content saved more than once - same base name differing only by extension (.doc/.docx) and/or
// a copy artifact ("(1)"/"(2)", "- Copy", "Copy of ..."). Deliberately does NOT strip
// content-distinguishing numbers (CONTEST 3 vs CONTEST 4, ROUND 1-1 vs ROUND 1-2, PROBLEM OF
// THE DAY-1 vs -2), so genuinely different questions are not merged.

const fs = require('fs');
const path = require('path');
const { RAW_DIR } = require('./classify-questions');

// Conservative: strip only extension + trailing copy artifacts. Applied repeatedly so
// "X (1) - Copy.docx" collapses fully. Leaves any "-N" / "(N)" that sits mid-name alone.
function conservativeBase(name) {
  let b = name.replace(/\.(docx?|pdf|txt)$/i, '');
  let prev;
  do {
    prev = b;
    b = b.replace(/\s*-\s*copy$/i, ''); // "- Copy"
    b = b.replace(/\s*\(\d+\)$/i, ''); // trailing "(1)"
    b = b.replace(/\s+$/,'');
  } while (b !== prev);
  b = b.replace(/^copy of\s+/i, ''); // "Copy of X"
  return b.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Aggressive add-on: also fold a trailing "-N" or "-N-N" download/copy artifact (e.g.
// "... Speed race (1)-1-1") - but ONLY when the folded base matches some OTHER file's
// conservative base, so we never collapse a standalone numbered series (ROUND 1-1..1-14 stay
// separate unless a plain "ROUND 1" sibling actually exists).
function aggressiveBase(name) {
  let b = conservativeBase(name);
  b = b.replace(/(\s*-\s*\d+)+$/,'').trim(); // trailing -N, -N-N
  b = b.replace(/\s*\(\d+\)$/,'').trim(); // a "(1)" that became trailing after -N removal
  return b;
}

function main() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .sort();

  // Conservative clustering
  const consClusters = new Map();
  for (const f of files) {
    const key = conservativeBase(f);
    if (!consClusters.has(key)) consClusters.set(key, []);
    consClusters.get(key).push(f);
  }
  const consMulti = [...consClusters.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
  const consFiles = consMulti.reduce((a, [, v]) => a + v.length, 0);

  // Aggressive: which additional files fold in, without collapsing standalone series.
  const consBases = new Set([...consClusters.keys()]);
  const aggClusters = new Map();
  for (const f of files) {
    let key = aggressiveBase(f);
    // Only accept the aggressive fold if it lands on an existing conservative base that is a
    // DIFFERENT, shorter key (i.e. there really is a plainer sibling family). Otherwise keep
    // the conservative key so numbered series aren't merged.
    if (key !== conservativeBase(f) && consBases.has(key)) {
      // folds onto a real plainer family
    } else {
      key = conservativeBase(f);
    }
    if (!aggClusters.has(key)) aggClusters.set(key, []);
    aggClusters.get(key).push(f);
  }
  const aggMulti = [...aggClusters.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
  const aggFiles = aggMulti.reduce((a, [, v]) => a + v.length, 0);

  const line = (s = '') => console.log(s);
  line('='.repeat(90));
  line('DUPLICATE-LOOKING FILENAME CLUSTERS (report only)');
  line('='.repeat(90));
  line(`Total files scanned: ${files.length}`);
  line();
  line('CONSERVATIVE (differ only by extension and/or "(N)" / "- Copy" artifact):');
  line(`  Clusters (2+ files): ${consMulti.length}`);
  line(`  Files accounted for by those clusters: ${consFiles}`);
  line(`  Redundant copies (files - clusters): ${consFiles - consMulti.length}`);
  line();
  line('  Clusters:');
  for (const [key, v] of consMulti) {
    line(`    [${v.length}] ${key}`);
    for (const f of v.sort()) line(`         ${f}`);
  }
  line();
  line('-'.repeat(90));
  line('AGGRESSIVE add-on (also folds a trailing -N/-N-N copy artifact onto an existing plainer');
  line('family only - never collapses a standalone numbered series):');
  line(`  Clusters (2+ files): ${aggMulti.length}`);
  line(`  Files accounted for: ${aggFiles}`);
  line(`  Redundant copies: ${aggFiles - aggMulti.length}`);
  line();
  line('  Clusters that GREW or are NEW vs conservative:');
  for (const [key, v] of aggMulti) {
    const cons = consClusters.get(key) || [];
    if (v.length !== cons.length) {
      line(`    [${v.length}] ${key}`);
      for (const f of v.sort()) line(`         ${f}`);
    }
  }
}

main();
