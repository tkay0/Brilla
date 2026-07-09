#!/usr/bin/env node
// Report-only diagnostic (no files touched). Scoped ONLY to the TrueFalse Pattern-2 occurrences
// (the 1,176 from scope-check-pattern2-by-roundtype.js) - General is excluded entirely. For each
// swallowed True/False statement (the text glued onto the tail of the preceding answer block),
// checks whether it is preceded by a numbered marker (1., 2., x.), the signal we planned to
// evaluate as a possible boundary rule for fixing Pattern 2 in True/False rounds.
//
// Uses the SAME splitBlocks/ANSWER logic that produced the 1,176 figure (ANSWER:/ANS: boundary
// only), so the denominator here is directly that 1,176.

const fs = require('fs');
const path = require('path');
const { RAW_DIR, extractText, splitIntoSegments, matchSegmentTypes } = require('./classify-questions');

const ANSWER_PREFIX_RE = /^(?:ANSWER|ANS)[:.\t ]*/i;
const TRAILING_CONTEST_LABEL_RE = /^[-–—]?\s*contest\s*\d+\.?\s*$/i;
const BLOCK_ANSWER_BOUNDARY_RE = /^(?:ANSWER|ANS)(?:[:.\t ]|$)/i;
// A line that starts with a numbered item marker: "1.", "23.", "x.", "4)".
const NUMBERED_LINE_RE = /^(?:\d{1,3}|x)[.)]\s+\S/i;

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

// The swallowed statement = everything in the answer block after its first (ANSWER:) line.
function swallowedTail(block) {
  return block
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean);
}

async function main() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .filter((f) => ['.doc', '.docx'].includes(path.extname(f).toLowerCase()))
    .sort();

  let total = 0;
  let withMarker = 0;
  let tailWithoutMarker = 0;
  let emptyTail = 0;
  const markerExamples = [];
  const noMarkerExamples = [];

  for (const fileName of files) {
    let text;
    try {
      text = await extractText(path.join(RAW_DIR, fileName));
    } catch {
      continue;
    }
    if (!text) continue;

    for (const segment of splitIntoSegments(text)) {
      if (!matchSegmentTypes(segment).includes('TrueFalse')) continue; // TrueFalse-only scope
      const blocks = splitBlocks(stripHeader(segment));

      for (let i = 0; i + 1 < blocks.length; i++) {
        const block = blocks[i];
        if (!ANSWER_PREFIX_RE.test(block)) continue;
        const rawAnswer = block.replace(ANSWER_PREFIX_RE, '').trim();
        if (isEffectivelyEmptyAnswer(rawAnswer)) continue;
        if (!ANSWER_PREFIX_RE.test(blocks[i + 1])) continue;

        // Pattern-2 occurrence in a TrueFalse segment.
        total++;
        const tail = swallowedTail(block);
        const hasMarker = tail.some((l) => NUMBERED_LINE_RE.test(l));
        if (tail.length === 0) {
          emptyTail++;
        } else if (hasMarker) {
          withMarker++;
          if (markerExamples.length < 10) {
            markerExamples.push({ fileName, block, next: blocks[i + 1] });
          }
        } else {
          tailWithoutMarker++;
          if (noMarkerExamples.length < 5) noMarkerExamples.push({ fileName, block, next: blocks[i + 1] });
        }
      }
    }
  }

  const pctOfTotal = total ? ((withMarker / total) * 100).toFixed(1) : '0.0';
  const withSwallowed = withMarker + tailWithoutMarker;
  const pctOfSwallowed = withSwallowed ? ((withMarker / withSwallowed) * 100).toFixed(1) : '0.0';

  const line = (s = '') => console.log(s);
  const trunc = (s, n = 150) => s.replace(/\n/g, ' / ').replace(/\s+/g, ' ').slice(0, n);

  line('='.repeat(90));
  line('TRUE/FALSE Pattern-2: is the swallowed statement preceded by a numbered marker?');
  line('='.repeat(90));
  line(`TrueFalse Pattern-2 occurrences found: ${total}  (compare: scope-check reported 1,176)`);
  line();
  line(`  Swallowed statement HAS a numbered marker (1./2./x.):  ${withMarker}`);
  line(`  Swallowed statement present but NO numbered marker:    ${tailWithoutMarker}`);
  line(`  No swallowed tail text (answer directly abuts answer):  ${emptyTail}`);
  line();
  line(`  % of ALL occurrences with a numbered marker:            ${pctOfTotal}%`);
  line(`  % of occurrences that HAVE a swallowed statement:       ${pctOfSwallowed}%  (${withMarker}/${withSwallowed})`);
  line();

  line('-'.repeat(90));
  line('10 examples WITH a numbered marker (answer block -> swallowed statement in its tail):');
  line('-'.repeat(90));
  markerExamples.forEach((e, i) => {
    line(`${i + 1}. [${e.fileName}]`);
    line(`   block:      "${trunc(e.block)}"`);
    line(`   next block: "${trunc(e.next, 70)}"`);
    line();
  });

  line('-'.repeat(90));
  line('5 examples WITHOUT a numbered marker (for contrast):');
  line('-'.repeat(90));
  noMarkerExamples.forEach((e, i) => {
    line(`${i + 1}. [${e.fileName}]`);
    line(`   block:      "${trunc(e.block)}"`);
    line(`   next block: "${trunc(e.next, 70)}"`);
    line();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
