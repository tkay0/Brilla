#!/usr/bin/env node
// Diagnostic only - no fixes, no output files written. Searches for other segments matching
// ROUND 1-10.doc's pattern: a segment matched to EXACTLY ONE type (TrueFalse or SpeedRace,
// not combined with General/other types), where the majority of the QA pairs it DOES form
// have answers that don't fit that type's expected format - for TrueFalse specifically, an
// answer that isn't true/false/t/f (logged by extract.js as "Could not parse boolean from
// answer" and silently dropped, with no fallback to General since the segment was never
// matched as General in the first place).
//
// SpeedRace has no equivalent content-format rejection (extractSpeedRace() accepts any answer
// text unconditionally), so this specific failure mode is structurally impossible for
// SpeedRace-only segments - checked and reported as such, not just assumed.

const fs = require('fs');
const path = require('path');
const { RAW_DIR, extractText, splitIntoSegments, matchSegmentTypes } = require('./classify-questions');

// --- Mirrors extract.js's current splitBlocks()/parseQABlocks() exactly ---
const BLOCK_ANSWER_BOUNDARY_RE = /^(?:(?:ANSWER|ANS)(?:[:.\t ]|$)|A[.:])/i;
const BLOCK_QUESTION_BOUNDARY_RE = /^Q[.:]/i;
const INLINE_ANSWER_MARKER_RE = /(\S)[ \t]*\b((?:ANSWER|ANS)\s*[:.])/gi;
const ANSWER_PREFIX_RE = /^(?:(?:ANSWER|ANS)[:.\t ]*|A[.:][ \t]*)/i;
const ANSWER_BLOCK_RE = new RegExp(ANSWER_PREFIX_RE.source, 'i');
const QUESTION_PREFIX_RE = /^Q[.:][ \t]*/i;
const PREAMBLE_BLOCK_RE = /^PREAMBLE[:.\t ]*/i;
const REASON_BLOCK_RE = /^REASON[:.\t ]*/i;
const TRAILING_CONTEST_LABEL_RE = /^[-–—]?\s*contest\s*\d+\.?\s*$/i;
const CALC_CONTINUATION_RE = /^.{0,20}=/;
const STANDALONE_QUESTION_START_RE =
  /^(what|which|how|why|when|where|who|explain|describe|state|give|calculate|find|determine|name|identify|define)\b/i;

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

function cleanText(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function splitBlocks(bodyText) {
  const withInlineBreaks = bodyText.replace(INLINE_ANSWER_MARKER_RE, '$1\n$2');
  const blocks = [];
  for (const blankChunk of withInlineBreaks.split(/\n\s*\n+/)) {
    let current = [];
    for (const line of blankChunk.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (current.length > 0 && (BLOCK_ANSWER_BOUNDARY_RE.test(trimmed) || BLOCK_QUESTION_BOUNDARY_RE.test(trimmed))) {
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

function parseQABlocks(bodyText) {
  const blocks = splitBlocks(bodyText);
  const pairs = [];
  let pendingQuestionParts = [];
  let preamble = null;
  let lastPair = null;
  let collectingEmptyAnswer = false;

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    if (PREAMBLE_BLOCK_RE.test(block)) {
      collectingEmptyAnswer = false;
      preamble = block.replace(PREAMBLE_BLOCK_RE, '').trim();
      continue;
    }
    if (ANSWER_BLOCK_RE.test(block)) {
      const rawAnswer = block.replace(ANSWER_BLOCK_RE, '').trim();
      const effectivelyEmpty = isEffectivelyEmptyAnswer(rawAnswer);
      if (collectingEmptyAnswer && lastPair) {
        if (!effectivelyEmpty) {
          lastPair.answerText += `${lastPair.answerText ? ' ' : ''}${rawAnswer}`;
          collectingEmptyAnswer = false;
        }
        continue;
      }
      if (pendingQuestionParts.length === 0) {
        lastPair = null;
        collectingEmptyAnswer = false;
        continue;
      }
      let questionText = pendingQuestionParts.join(' ').trim().replace(QUESTION_PREFIX_RE, '');
      if (preamble) questionText = `${preamble} ${questionText}`;
      lastPair = { questionText: cleanText(questionText), answerText: effectivelyEmpty ? '' : rawAnswer };
      pairs.push(lastPair);
      pendingQuestionParts = [];
      collectingEmptyAnswer = effectivelyEmpty;
      continue;
    }
    if (REASON_BLOCK_RE.test(block)) {
      collectingEmptyAnswer = false;
      if (lastPair) lastPair.answerText += ` ${block.replace(REASON_BLOCK_RE, '').trim()}`;
      continue;
    }
    if (collectingEmptyAnswer && lastPair) {
      lastPair.answerText += `${lastPair.answerText ? ' ' : ''}${block}`;
      continue;
    }
    if (lastPair && CALC_CONTINUATION_RE.test(block)) {
      lastPair.answerText += ` ${block}`;
      continue;
    }
    lastPair = null;
    collectingEmptyAnswer = false;
    if (preamble && pendingQuestionParts.length === 0 && STANDALONE_QUESTION_START_RE.test(block)) {
      preamble = null;
    }
    pendingQuestionParts.push(block);
  }
  return pairs;
}

const TF_ANSWER_RE = /^(true|false|t|f)\b/i;

async function main() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .filter((f) => ['.doc', '.docx'].includes(path.extname(f).toLowerCase()))
    .sort();

  const tfHits = []; // { fileName, header, total, nonBoolean }
  let speedRaceOnlySegments = 0;
  let errored = [];

  for (const fileName of files) {
    let text;
    try {
      text = await extractText(path.join(RAW_DIR, fileName));
    } catch {
      errored.push(fileName);
      continue;
    }
    if (!text) continue;

    for (const segment of splitIntoSegments(text)) {
      const matchedTypes = matchSegmentTypes(segment);
      if (matchedTypes.length !== 1) continue; // only "matched to exactly one type" segments

      const type = matchedTypes[0];
      if (type !== 'TrueFalse' && type !== 'SpeedRace') continue;

      const pairs = parseQABlocks(stripHeader(segment));
      if (pairs.length === 0) continue;

      if (type === 'TrueFalse') {
        const nonBoolean = pairs.filter((p) => !TF_ANSWER_RE.test(p.answerText.trim())).length;
        if (nonBoolean > pairs.length / 2) {
          const header = (segment.split(/\r?\n/).find((l) => l.trim()) || '').trim();
          tfHits.push({ fileName, header, total: pairs.length, nonBoolean });
        }
      } else if (type === 'SpeedRace') {
        speedRaceOnlySegments++;
      }
    }
  }

  const distinctFiles = new Set(tfHits.map((h) => h.fileName));

  const line = (s = '') => console.log(s);
  line('='.repeat(90));
  line('SEARCH: TrueFalse/SpeedRace-only segments where most answers fail to fit the type');
  line('='.repeat(90));
  line(`Files scanned: ${files.length} (errored: ${errored.length})`);
  line();
  line('TrueFalse-only segments (ROUND 1-10.doc pattern):');
  line(`  Segments affected: ${tfHits.length}`);
  line(`  Distinct files affected: ${distinctFiles.size}`);
  line();
  for (const h of tfHits.sort((a, b) => b.nonBoolean / b.total - a.nonBoolean / a.total)) {
    line(`  - ${h.fileName}  [${h.header}]  ${h.nonBoolean}/${h.total} pairs non-boolean (${((h.nonBoolean / h.total) * 100).toFixed(0)}%)`);
  }
  line();
  line('SpeedRace-only segments:');
  line(`  Segments matched (SpeedRace-only, with >=1 formed pair): ${speedRaceOnlySegments}`);
  line('  Content-format rejection is structurally impossible for SpeedRace: extractSpeedRace()');
  line('  accepts any answer text unconditionally (no boolean/format check exists to fail),');
  line('  so this failure mode cannot occur there by construction - 0 by design, not by luck.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
