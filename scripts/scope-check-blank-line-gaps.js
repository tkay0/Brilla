#!/usr/bin/env node
// Report-only diagnostic (does not modify extract.js or write any output files): scans every
// file in content/raw-questions for two known extract.js parsing gaps, both rooted in
// splitBlocks() relying solely on blank-line boundaries to separate question/answer blocks:
//
//   Pattern 1 (ROUND 2-1.doc bug): a question and its "ANSWER:"/"ANS:" line sit on adjacent
//   lines with no blank line between them, so splitBlocks() merges them into a single block
//   instead of two - parseQABlocks() then can't split them back into a Q/A pair.
//
//   Pattern 2 (MAIN CONTEST 28.docx bug): an answer's trailing explanation text bleeds into
//   the start of the next question with no blank line marking the boundary, so the next
//   question's real "ANSWER:" block ends up immediately following another answer-led block
//   with no question block in between - the tell-tale signature of a swallowed question.
//
// Both patterns are detected against the same block-splitting logic extract.js actually uses
// (stripHeader + splitBlocks), scoped to segments that go through parseQABlocks (General,
// SpeedRace, ProblemOfDay, TrueFalse - not Riddle, which uses a different parser).

const fs = require('fs');
const path = require('path');
const { RAW_DIR, extractText, splitIntoSegments, matchSegmentTypes } = require('./classify-questions');

const ANSWER_PREFIX_RE = /^(?:ANSWER|ANS)[:.\t ]*/i;
const TRAILING_CONTEST_LABEL_RE = /^[-–—]?\s*contest\s*\d+\.?\s*$/i;

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

// Mirrors the fix applied to extract.js's splitBlocks(): a line starting with
// "ANSWER:"/"ANS:" is now an unconditional block boundary, not just a blank line.
const BLOCK_ANSWER_BOUNDARY_RE = /^(?:ANSWER|ANS)(?:[:.\t ]|$)/i;

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
  if (matchedTypes.length === 0) return true; // defaults to General in extract.js
  return matchedTypes.some((t) => QA_TYPES.has(t));
}

async function main() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .filter((f) => ['.doc', '.docx'].includes(path.extname(f).toLowerCase()))
    .sort();

  const pattern1Files = new Map(); // file -> [{segmentHeader, blockExcerpt}]
  const pattern2Files = new Map();
  let errored = [];

  for (const fileName of files) {
    let text;
    try {
      text = await extractText(path.join(RAW_DIR, fileName));
    } catch (err) {
      errored.push(`${fileName} (${err.message})`);
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
        const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

        // Pattern 1: an ANSWER/ANS marker appears at the start of a line other than the
        // block's own first line - i.e. glued to preceding question text with no blank line.
        const hasMidBlockAnswer = lines.slice(1).some((l) => ANSWER_PREFIX_RE.test(l));
        if (hasMidBlockAnswer) {
          if (!pattern1Files.has(fileName)) pattern1Files.set(fileName, []);
          pattern1Files.get(fileName).push({ segHeader, excerpt: block.slice(0, 100) });
        }

        // Pattern 2: this block is itself a real (non-empty, non-label) answer block, and the
        // very next block is *also* answer-led - no question block separates them, meaning
        // the next question's text got swallowed into this block's tail instead.
        if (ANSWER_PREFIX_RE.test(block) && i + 1 < blocks.length) {
          const rawAnswer = block.replace(ANSWER_PREFIX_RE, '').trim();
          const nextBlock = blocks[i + 1];
          if (!isEffectivelyEmptyAnswer(rawAnswer) && ANSWER_PREFIX_RE.test(nextBlock)) {
            if (!pattern2Files.has(fileName)) pattern2Files.set(fileName, []);
            pattern2Files.get(fileName).push({
              segHeader,
              excerpt: `${block.slice(0, 60)} ... || next: ${nextBlock.slice(0, 60)}`,
            });
          }
        }
      }
    }
  }

  const line = (s = '') => console.log(s);
  line('='.repeat(90));
  line('SCOPE CHECK: blank-line separator gaps across content/raw-questions');
  line('='.repeat(90));
  line(`Files scanned: ${files.length} (errored/unreadable: ${errored.length})`);
  line();
  line(`Pattern 1 (Q immediately followed by A, no blank line - "ROUND 2-1.doc bug"):`);
  line(`  Files affected: ${pattern1Files.size}`);
  line(`  Blocks affected: ${[...pattern1Files.values()].reduce((a, v) => a + v.length, 0)}`);
  for (const [f, hits] of pattern1Files) {
    line(`  - ${f}  (${hits.length} block(s))`);
    line(`      e.g. [${hits[0].segHeader}] "${hits[0].excerpt.replace(/\n/g, ' / ')}..."`);
  }
  line();
  line(`Pattern 2 (answer's trailing text bleeds into next question - "MAIN CONTEST 28.docx bug"):`);
  line(`  Files affected: ${pattern2Files.size}`);
  line(`  Block-pairs affected: ${[...pattern2Files.values()].reduce((a, v) => a + v.length, 0)}`);
  for (const [f, hits] of pattern2Files) {
    line(`  - ${f}  (${hits.length} occurrence(s))`);
    line(`      e.g. [${hits[0].segHeader}] "${hits[0].excerpt.replace(/\n/g, ' / ')}"`);
  }
  line();
  const union = new Set([...pattern1Files.keys(), ...pattern2Files.keys()]);
  line(`Union: ${union.size} distinct file(s) affected by at least one pattern.`);
  if (errored.length) {
    line();
    line(`Errored/unreadable files (not scanned): ${errored.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
