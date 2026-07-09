#!/usr/bin/env node
// Diagnostic only - no fixes applied, no output files written. For every remaining Pattern 2
// occurrence (see scope-check-blank-line-gaps.js: an answer block immediately followed by
// another answer block, meaning the question between them got swallowed into the tail of the
// first block), checks whether the swallowed question happens to start with a numbered-list
// marker ("1.", "2.", "x.") on its own line - a candidate signal for a future boundary rule.
// Reports what fraction of occurrences have the marker, and prints 5 examples of each so the
// signal's reliability can be judged by eye before anyone trusts it as a splitting rule.

const fs = require('fs');
const path = require('path');
const {
  RAW_DIR,
  extractText,
  splitIntoSegments,
  matchSegmentTypes,
  NUMBERED_ITEM_RE,
} = require('./classify-questions');

const ANSWER_PREFIX_RE = /^(?:ANSWER|ANS)[:.\t ]*/i;
const TRAILING_CONTEST_LABEL_RE = /^[-–—]?\s*contest\s*\d+\.?\s*$/i;
const BLOCK_ANSWER_BOUNDARY_RE = /^(?:ANSWER|ANS)(?:[:.\t ]|$)/i;

function isEffectivelyEmptyAnswer(rawAnswer) {
  return rawAnswer.length === 0 || TRAILING_CONTEST_LABEL_RE.test(rawAnswer);
}

function stripHeader(segmentText) {
  const lines = segmentText.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length) i++;
  return lines.slice(i).join('\n');
}

// Mirrors extract.js's current (post-fix) splitBlocks().
function splitBlocks(bodyText) {
  const blocks = [];
  for (const blankChunk of bodyText.split(/\n\s*\n+/)) {
    let current = [];
    for (const line of blankChunk.split(/\r?\n/)) {
      if (current.length > 0 && BLOCK_ANSWER_BOUNDARY_RE.test(line.trim())) {
        blocks.push(current.join('\n'));
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) blocks.push(current.join('\n'));
  }
  return blocks.map((b) => b.trim()).filter(Boolean);
}

const QA_TYPES = new Set(['General', 'SpeedRace', 'ProblemOfDay', 'TrueFalse']);
function usesQABlockParser(matchedTypes) {
  if (matchedTypes.length === 0) return true;
  return matchedTypes.some((t) => QA_TYPES.has(t));
}

async function main() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .filter((f) => ['.doc', '.docx'].includes(path.extname(f).toLowerCase()))
    .sort();

  const withMarker = [];
  const withoutMarker = [];

  for (const fileName of files) {
    let text;
    try {
      text = await extractText(path.join(RAW_DIR, fileName));
    } catch {
      continue;
    }
    if (!text) continue;

    const segments = splitIntoSegments(text);
    for (const segment of segments) {
      const matchedTypes = matchSegmentTypes(segment);
      if (!usesQABlockParser(matchedTypes)) continue;

      const segHeader = (segment.split(/\r?\n/).find((l) => l.trim()) || '').trim().slice(0, 60);
      const body = stripHeader(segment);
      const blocks = splitBlocks(body);

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!ANSWER_PREFIX_RE.test(block) || i + 1 >= blocks.length) continue;
        const rawAnswer = block.replace(ANSWER_PREFIX_RE, '').trim();
        const nextBlock = blocks[i + 1];
        if (isEffectivelyEmptyAnswer(rawAnswer) || !ANSWER_PREFIX_RE.test(nextBlock)) continue;

        // This is a Pattern 2 occurrence. Does the swallowed-question tail (everything in the
        // block after its own first line) contain a numbered-list-marker line?
        const lines = block.split(/\r?\n/);
        const tailLines = lines.slice(1);
        const markerLineIdx = tailLines.findIndex((l) => NUMBERED_ITEM_RE.test(l));
        const record = {
          fileName,
          segHeader,
          block,
          nextBlock,
          markerLine: markerLineIdx !== -1 ? tailLines[markerLineIdx].trim() : null,
        };
        if (markerLineIdx !== -1) withMarker.push(record);
        else withoutMarker.push(record);
      }
    }
  }

  const total = withMarker.length + withoutMarker.length;
  const pct = total ? ((withMarker.length / total) * 100).toFixed(1) : '0.0';

  const line = (s = '') => console.log(s);
  line('='.repeat(90));
  line('PATTERN 2 DIAGNOSTIC: does the swallowed question start with a numbered-list marker?');
  line('='.repeat(90));
  line(`Total Pattern 2 occurrences (post ANSWER:-boundary fix): ${total}`);
  line(`  With a numbered-marker line in the tail: ${withMarker.length} (${pct}%)`);
  line(`  Without one:                             ${withoutMarker.length} (${(100 - pct).toFixed(1)}%)`);
  line();

  line('-'.repeat(90));
  line('5 examples WITH a numbered marker present:');
  line('-'.repeat(90));
  withMarker.slice(0, 5).forEach((r, i) => {
    line(`${i + 1}. [${r.fileName}] [${r.segHeader}]`);
    line(`   block:      "${r.block.replace(/\n/g, ' / ').slice(0, 220)}"`);
    line(`   next block: "${r.nextBlock.replace(/\n/g, ' / ').slice(0, 100)}"`);
    line(`   marker line found: "${r.markerLine}"`);
    line();
  });

  line('-'.repeat(90));
  line("5 examples WITHOUT a numbered marker (swallowed question is plain prose):");
  line('-'.repeat(90));
  withoutMarker.slice(0, 5).forEach((r, i) => {
    line(`${i + 1}. [${r.fileName}] [${r.segHeader}]`);
    line(`   block:      "${r.block.replace(/\n/g, ' / ').slice(0, 220)}"`);
    line(`   next block: "${r.nextBlock.replace(/\n/g, ' / ').slice(0, 100)}"`);
    line();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
