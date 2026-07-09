#!/usr/bin/env node
// Diagnostic only - no fixes applied, no output files written. Breaks down the 3,204
// remaining Pattern 2 occurrences (see scope-check-blank-line-gaps.js) by which round type(s)
// the containing segment was matched to.
//
// Important mechanical note: General/SpeedRace/ProblemOfDay/TrueFalse extraction all call
// parseQABlocks() on the *same* stripped segment body (see extract.js's extractFile loop), so
// when a segment matches more than one of those types (e.g. a combined "Round 5" header that's
// both SpeedRace and TrueFalse), the same Pattern 2 occurrence is independently hit by each
// matched type's extraction call and produces a bad entry in each type's output bucket - it is
// correctly counted once per matched type below, so the per-type counts can sum to more than
// 3,204 and that's not a bug in this script.
//
// Riddle is mechanically different: extractRiddle() uses parseRiddleSegment(), not
// parseQABlocks()/splitBlocks() - it is not exposed to this bug at all. Riddle is reported
// separately as "segment also matched Riddle" (an overlap note), not as its own occurrence
// count, since attributing block-splitting occurrences to a parser that never sees those
// blocks would be misleading.

const fs = require('fs');
const path = require('path');
const { RAW_DIR, extractText, splitIntoSegments, matchSegmentTypes } = require('./classify-questions');

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

// Mirrors extract.js's current (post ANSWER:-boundary-fix) splitBlocks().
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

const QA_TYPES = ['General', 'SpeedRace', 'ProblemOfDay', 'TrueFalse'];

async function main() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .filter((f) => ['.doc', '.docx'].includes(path.extname(f).toLowerCase()))
    .sort();

  const counts = Object.fromEntries(QA_TYPES.map((t) => [t, 0]));
  const filesByType = Object.fromEntries(QA_TYPES.map((t) => [t, new Set()]));
  const riddleOverlapFiles = new Set();
  let totalOccurrences = 0;

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
      let matchedTypes = matchSegmentTypes(segment);
      const hasRiddle = matchedTypes.includes('Riddle');
      const qaTypesForSegment = matchedTypes.length === 0 ? ['General'] : matchedTypes.filter((t) => QA_TYPES.includes(t));
      if (qaTypesForSegment.length === 0) continue;

      const body = stripHeader(segment);
      const blocks = splitBlocks(body);

      let segmentHasOccurrence = false;
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!ANSWER_PREFIX_RE.test(block) || i + 1 >= blocks.length) continue;
        const rawAnswer = block.replace(ANSWER_PREFIX_RE, '').trim();
        const nextBlock = blocks[i + 1];
        if (isEffectivelyEmptyAnswer(rawAnswer) || !ANSWER_PREFIX_RE.test(nextBlock)) continue;

        segmentHasOccurrence = true;
        totalOccurrences++;
        for (const t of qaTypesForSegment) {
          counts[t]++;
          filesByType[t].add(fileName);
        }
      }
      if (segmentHasOccurrence && hasRiddle) riddleOverlapFiles.add(fileName);
    }
  }

  const line = (s = '') => console.log(s);
  line('='.repeat(90));
  line('PATTERN 2 BREAKDOWN BY ROUND TYPE');
  line('='.repeat(90));
  line(`Total occurrences found (segment-level, before per-type attribution): ${totalOccurrences}`);
  line(`(Per-type counts below sum to more than this when a segment matches multiple types -`);
  line(` each matched type's extraction independently hits the same occurrence. See comment`);
  line(` at top of this script.)`);
  line();
  const sumOfCounts = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const t of QA_TYPES) {
    const pct = totalOccurrences ? ((counts[t] / totalOccurrences) * 100).toFixed(1) : '0.0';
    line(`  ${t.padEnd(12)} ${String(counts[t]).padStart(5)} occurrences  (${pct}% of the ${totalOccurrences} segment-level total)  across ${filesByType[t].size} file(s)`);
  }
  line(`  Riddle          0 occurrences  (extractRiddle() uses a different parser - not exposed to this bug)`);
  line();
  line(`Sum of per-type counts: ${sumOfCounts} (vs. ${totalOccurrences} distinct segment-level occurrences)`);
  line();

  line('-'.repeat(90));
  line('Files contributing scored-round (SpeedRace / TrueFalse) occurrences:');
  line('-'.repeat(90));
  for (const t of ['SpeedRace', 'TrueFalse']) {
    line(`${t}: ${filesByType[t].size} file(s)`);
    for (const f of [...filesByType[t]].sort()) line(`  - ${f}`);
    line();
  }

  line('-'.repeat(90));
  line('Riddle: mechanically 0 direct occurrences. Files where a Pattern-2-affected segment');
  line('was ALSO matched as Riddle (i.e. a combined round header, e.g. "True/False + Riddles"):');
  line('-'.repeat(90));
  line(`${riddleOverlapFiles.size} file(s)`);
  for (const f of [...riddleOverlapFiles].sort()) line(`  - ${f}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
