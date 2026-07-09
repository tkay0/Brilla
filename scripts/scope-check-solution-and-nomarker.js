#!/usr/bin/env node
// Diagnostic only - no fixes, no output files written. Two scope questions ahead of deciding
// whether to build a dedicated SOLUTION-block parser and how to handle the no-marker format:
//
//   Part A - SOLUTION-heading batched format (the DOC-20190819-WA0008.docx shape): questions
//   listed together under a contest header, then a standalone "SOLUTION" line, then the answers
//   batched below. Counted by standalone-"SOLUTION" lines. Split further by whether the file
//   ALSO has ANSWER:/ANS: markers (SOLUTION is a sub-label of a normal answer) vs. none at all
//   (SOLUTION is the primary Q/A separator - the genuinely unhandled batched shape).
//
//   Part B - no-marker paragraph-alternation (the NSMQ Speed Race sample shape): alternating
//   question-paragraph / answer-paragraph, blank-line separated, dotted "………" divider between
//   contests, and NO answer label anywhere. Per the request this isn't auto-classified with
//   confidence - instead we find files with no recognizable answer separator at all (no
//   ANSWER/ANS/Ans, no standalone SOLUTION, no "who am i") and report whether they carry the
//   NSMQ dotted-divider signature, then confirm the already-known-0-extraction files land here.

const fs = require('fs');
const path = require('path');
const { RAW_DIR, extractText } = require('./classify-questions');

// Answer label anywhere in the text: block-start OR inline, word-boundary guarded (so
// "means:", "plans:", "Hans:" don't count), separator required.
const ANSWER_MARKER_RE = /\b(?:ANSWER|ANS)\s*[:.]/gi;
const WHO_RE = /who\s+(?:am\s+i|are\s+we)/gi;
const SOLUTION_STANDALONE_RE = /^\s*SOLUTIONS?\s*[:.]?\s*$/i;
// Single-letter "A." / "A:" answer prefix and "Q." / "Q:" question prefix at line start - a
// distinct labelling scheme (e.g. lowercase "Contest N.doc") that neither the ANSWER: parser
// nor a SOLUTION-block parser would handle, and which contaminates the SOLUTION bucket when
// such a file also happens to contain one stray SOLUTION line.
const A_PREFIX_RE = /^\s*A\s*[.:]\s+\S/;
const Q_PREFIX_RE = /^\s*Q\s*[.:]\s+\S/;
// A line that is essentially a run of dots / ellipses (contest divider in the NSMQ sample).
const DOTTED_DIVIDER_RE = /^[\s]*[.…·]{5,}[\s.…·]*$/;

// Files observed to extract ~0 questions in the batch-22 real run (SpeedRace/ProblemOfDay
// near-total-failure finding). Used to confirm they fall into the shapes described.
const KNOWN_ZERO_EXTRACTION = new Set([
  'NSMQ 2017 Biology Questions - Speed race (1).docx',
  'DOC-20190819-WA0008.docx',
]);

async function main() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .filter((f) => ['.doc', '.docx'].includes(path.extname(f).toLowerCase()))
    .sort();

  const perFile = [];
  const errored = [];

  for (const fileName of files) {
    let text;
    try {
      text = await extractText(path.join(RAW_DIR, fileName));
    } catch (err) {
      errored.push(fileName);
      continue;
    }
    text = text || '';
    const lines = text.split(/\r?\n/);
    const nonBlank = lines.filter((l) => l.trim()).length;

    const answerMarkers = (text.match(ANSWER_MARKER_RE) || []).length;
    const whoAmI = (text.match(WHO_RE) || []).length;
    const solStandalone = lines.filter((l) => SOLUTION_STANDALONE_RE.test(l)).length;
    const dottedDividers = lines.filter((l) => DOTTED_DIVIDER_RE.test(l)).length;
    const aPrefix = lines.filter((l) => A_PREFIX_RE.test(l)).length;
    const qPrefix = lines.filter((l) => Q_PREFIX_RE.test(l)).length;

    perFile.push({ fileName, nonBlank, answerMarkers, whoAmI, solStandalone, dottedDividers, aPrefix, qPrefix });
  }

  // A file "uses A./A: answer prefixes" if several answer-prefixed lines appear (one stray
  // "A." is noise; a real Q./A. transcript has many).
  const usesAPrefix = (f) => f.aPrefix >= 3;

  // Part A
  const solFiles = perFile.filter((f) => f.solStandalone >= 1);
  const solWithAnswerMarker = solFiles.filter((f) => f.answerMarkers > 0);
  const solNoAnswerMarkerRaw = solFiles.filter((f) => f.answerMarkers === 0);
  // Separate the genuinely batched-SOLUTION files from ones that are really Q./A.-prefixed
  // transcripts merely containing a stray SOLUTION line.
  const solQAprefix = solNoAnswerMarkerRaw.filter(usesAPrefix);
  const solBatched = solNoAnswerMarkerRaw.filter((f) => !usesAPrefix(f));

  // Part B: no recognizable separator at all, but has real content. Exclude A./A:-prefixed
  // files - those do carry an answer marker, just a single-letter one.
  const noMarker = perFile.filter(
    (f) =>
      f.answerMarkers === 0 &&
      f.whoAmI === 0 &&
      f.solStandalone === 0 &&
      !usesAPrefix(f) &&
      f.nonBlank >= 10
  );
  const noMarkerWithDivider = noMarker.filter((f) => f.dottedDividers >= 1);

  const line = (s = '') => console.log(s);
  line('='.repeat(90));
  line('SCOPE CHECK: SOLUTION-batched format vs. no-marker paragraph-alternation format');
  line('='.repeat(90));
  line(`Files scanned: ${perFile.length} (errored/unreadable: ${errored.length}${errored.length ? ' - ' + errored.join(', ') : ''})`);
  line();

  line('-'.repeat(90));
  line('PART A - standalone "SOLUTION" heading present');
  line('-'.repeat(90));
  line(`Files with >=1 standalone SOLUTION line: ${solFiles.length}`);
  line(`  ...WITH ANSWER:/ANS: markers too (SOLUTION is a sub-label, already handled by ANSWER parser): ${solWithAnswerMarker.length}`);
  line(`  ...NO ANSWER markers but Q./A.-prefixed transcript (SOLUTION line is incidental; separate format): ${solQAprefix.length}`);
  line(`  ...NO ANSWER markers, NOT A.-prefixed = genuine batched-SOLUTION shape (unhandled): ${solBatched.length}`);
  line();
  line('  Genuine batched-SOLUTION files (standalone SOLUTION, no ANSWER markers, no A. prefixes):');
  for (const f of solBatched) {
    line(`    - ${f.fileName}  (SOLUTION lines: ${f.solStandalone}, nonBlank: ${f.nonBlank}${KNOWN_ZERO_EXTRACTION.has(f.fileName) ? '  [known-0-extraction]' : ''})`);
  }
  line();
  line('  (Q./A.-prefixed files caught in the SOLUTION bucket - a separate unhandled format:');
  for (const f of solQAprefix) {
    line(`    - ${f.fileName}  (aPrefix lines: ${f.aPrefix}, qPrefix: ${f.qPrefix}, nonBlank: ${f.nonBlank})`);
  }
  line('  )');
  line();

  line('-'.repeat(90));
  line('PART B - no answer separator of any kind (candidates for paragraph-alternation)');
  line('-'.repeat(90));
  line(`Files with NO ANSWER/ANS/Ans marker, NO standalone SOLUTION, NO "who am i", >=10 non-blank lines: ${noMarker.length}`);
  line(`  ...of those carrying the NSMQ dotted-"………"-divider signature: ${noMarkerWithDivider.length}`);
  line();
  line('  No-marker files (all), with divider signal noted:');
  for (const f of noMarker) {
    line(`    - ${f.fileName}  (nonBlank: ${f.nonBlank}, dottedDividers: ${f.dottedDividers}${f.dottedDividers >= 1 ? ' <-shape match' : ''}, qPrefix: ${f.qPrefix}${KNOWN_ZERO_EXTRACTION.has(f.fileName) ? '  [known-0-extraction]' : ''})`);
  }
  line();

  line('-'.repeat(90));
  line('Known-0-extraction files - where did they land?');
  line('-'.repeat(90));
  for (const name of KNOWN_ZERO_EXTRACTION) {
    const f = perFile.find((x) => x.fileName === name);
    if (!f) {
      line(`  - ${name}: NOT FOUND / errored`);
      continue;
    }
    const bucket =
      f.solStandalone >= 1 && f.answerMarkers === 0
        ? 'Part A (SOLUTION-batched, no markers)'
        : f.answerMarkers === 0 && f.whoAmI === 0 && f.solStandalone === 0
          ? 'Part B (no marker at all)'
          : 'neither (has some marker)';
    line(`  - ${name}: ${bucket}`);
    line(`      answerMarkers=${f.answerMarkers}, solStandalone=${f.solStandalone}, whoAmI=${f.whoAmI}, dottedDividers=${f.dottedDividers}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
