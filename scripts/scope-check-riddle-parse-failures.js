#!/usr/bin/env node
// Diagnostic only - no fixes, no output files written. Reproduces the 55 "[Riddle] Could not
// find a who am i/answer pair" warnings from batch 1's real run, and prints the RAW,
// unparsed segment text (before any cleanup) for a spread of examples across the different
// header shapes reported (RIDDLES, ROUND 4 - Riddles, Riddle #3/#4, etc.) so it's possible to
// tell whether this is one consistent unhandled format or several different causes.

const fs = require('fs');
const path = require('path');
const { RAW_DIR, extractText, splitIntoSegments, matchSegmentTypes } = require('./classify-questions');

const WHO_RE = /who\s+(?:am\s+i|are\s+we)\??/i;
const ANSWER_PREFIX_RE = /^(?:(?:ANSWER|ANS)[:.\t ]*|A[.:][ \t]*)/i;
const ANSWER_LINE_RE = new RegExp(`${ANSWER_PREFIX_RE.source}(.*)$`, 'i');

function stripHeader(segmentText) {
  const lines = segmentText.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length) i++;
  return lines.slice(i).join('\n');
}

// Mirrors extract.js's parseRiddleSegment() exactly - returns null on the same failure paths.
function parseRiddleSegment(segmentText) {
  const body = stripHeader(segmentText);
  const rawLines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let whoLineIdx = -1;
  let afterWho = '';
  for (let i = 0; i < rawLines.length; i++) {
    const m = rawLines[i].match(WHO_RE);
    if (m) {
      whoLineIdx = i;
      afterWho = rawLines[i].slice(m.index + m[0].length).trim();
      break;
    }
  }
  if (whoLineIdx === -1) return { ok: false, reason: 'no "who am i / who are we" line found anywhere in segment' };

  let rawAnswer = afterWho.replace(/^[-:.\s]+/, '').trim();
  if (!rawAnswer) {
    for (let i = whoLineIdx + 1; i < rawLines.length; i++) {
      const m = rawLines[i].match(ANSWER_LINE_RE);
      if (m) {
        rawAnswer = m[1].trim();
        break;
      }
      break;
    }
  }
  if (!rawAnswer) return { ok: false, reason: 'found "who am i" but no answer text right after it (inline or next line)' };
  return { ok: true };
}

const BATCH1_FILES = [
  'Contest 1-1.doc',
  'Contest 11.doc',
  'Contest 13.doc',
  'Contest 17.doc',
  'Contest 19.doc',
  'Contest 21-1.doc',
  'Contest 21-1.docx',
  'Contest 25-1-1.doc',
  'Contest 29-1.doc',
  'Contest 33-1.doc',
  'Contest 5-1.doc',
  'Contest 7-1.doc',
  'nsmq sample riddles.docx',
];

async function main() {
  const failures = [];
  for (const fileName of BATCH1_FILES) {
    let text;
    try {
      text = await extractText(path.join(RAW_DIR, fileName));
    } catch {
      continue;
    }
    if (!text) continue;

    for (const segment of splitIntoSegments(text)) {
      if (!matchSegmentTypes(segment).includes('Riddle')) continue;
      const result = parseRiddleSegment(segment);
      if (!result.ok) {
        const headerLine = (segment.split(/\r?\n/).find((l) => l.trim()) || '').trim();
        failures.push({ fileName, headerLine, reason: result.reason, segment });
      }
    }
  }

  console.log('='.repeat(90));
  console.log(`Total failing Riddle segments found across batch 1: ${failures.length} (report said 55)`);
  console.log('='.repeat(90));
  console.log();

  // Group by a normalized header "shape" so we can pick a spread rather than 10 from one file.
  const shapeOf = (h) =>
    h
      .toUpperCase()
      .replace(/\d+/g, 'N')
      .replace(/\s+/g, ' ')
      .trim();
  const byShape = new Map();
  for (const f of failures) {
    const s = shapeOf(f.headerLine);
    if (!byShape.has(s)) byShape.set(s, []);
    byShape.get(s).push(f);
  }

  console.log(`Distinct header shapes among failures: ${byShape.size}`);
  for (const [shape, items] of [...byShape.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  [${items.length}] "${shape}"  (e.g. "${items[0].headerLine}")`);
  }
  console.log();

  // Pick up to 10 examples, round-robin across shapes so we get a real spread, not 10 from
  // the biggest bucket.
  const shapeGroups = [...byShape.values()];
  const picked = [];
  let round = 0;
  while (picked.length < 10 && picked.length < failures.length) {
    let addedThisRound = false;
    for (const group of shapeGroups) {
      if (round < group.length) {
        picked.push(group[round]);
        addedThisRound = true;
        if (picked.length >= 10) break;
      }
    }
    if (!addedThisRound) break;
    round++;
  }

  console.log('='.repeat(90));
  console.log(`${picked.length} EXAMPLES - RAW, UNPARSED SEGMENT TEXT`);
  console.log('='.repeat(90));
  picked.forEach((f, i) => {
    console.log();
    console.log('-'.repeat(90));
    console.log(`Example ${i + 1} / ${picked.length}`);
    console.log(`File: ${f.fileName}`);
    console.log(`Header line: "${f.headerLine}"`);
    console.log(`Failure reason: ${f.reason}`);
    console.log('-'.repeat(90));
    console.log('RAW SEGMENT TEXT:');
    console.log(f.segment);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
