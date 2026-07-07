#!/usr/bin/env node
// Classification-only pass over content/raw-questions: for every .doc/.docx file, extract
// plain text (mammoth for .docx, word-extractor for legacy .doc) and infer docType, year,
// round types, subjects, and a rough question count. Does not extract full question text.

const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');

const RAW_DIR = path.join(__dirname, '..', 'content', 'raw-questions');
const OUT_CSV = path.join(__dirname, '..', 'content', 'question-classification.csv');

const ROUND_TYPES = ['General', 'SpeedRace', 'ProblemOfDay', 'TrueFalse', 'Riddle'];
const SUBJECTS = ['Physics', 'Biology', 'Chemistry', 'Maths'];

const wordExtractor = new WordExtractor();

const SPEED_RACE_RE = /speed\s*race/i;
const PROBLEM_OF_DAY_RE = /problem\s+of\s+the\s+day/i;
const TRUE_FALSE_RE = /true\s*(?:\/|or)\s*false/i;
const RIDDLE_RE = /riddle/i;
const WHO_AM_I_RE = /who\s+am\s+i/i;
const ANSWER_MARKER_RE = /\banswer\s*[:.]|\bans\s*[:.]/i;
const NUMBERED_ITEM_RE = /^\s*(?:\d{1,3}|x)[.)]\s+\S/im;
const STANDALONE_TF_RE = /^\s*(?:T|F|TRUE|FALSE)\s*(?:\[[^\]]*\])?\s*$/i;
// Numbered section headers ("CONTEST 3", "ROUND 4 - Riddles") - prefix match, since these
// often carry trailing suffixes like " - True or False" on the same line.
const NUM_BOUNDARY_RE = /^\s*(?:CONTEST|ROUND)\s*[-#]?\s*\d+/i;
// Special-round headers that sometimes appear on their own line with no ROUND N prefix
// (e.g. a bare "PROBLEM OF THE DAY" line). Whole-line match only, and length-capped, so we
// don't false-positive on a sentence that merely mentions one of these phrases.
const KEYWORD_BOUNDARY_RE =
  /^\s*(?:SPEED\s*RACE|PROBLEM\s+OF\s+THE\s+DAY|TRUE\s*(?:\/|OR)\s*FALSE|RIDDLE(?:S)?(?:\s*#?\d+)?)\s*[:.\-]?\s*$/i;
const YEAR_RE = /\b(19[9]\d|20[0-3]\d)\b/;

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  if (ext === '.doc') {
    const doc = await wordExtractor.extract(filePath);
    return doc.getBody();
  }
  return null;
}

function detectYear(fileName, text) {
  let m = fileName.match(YEAR_RE);
  if (m) return parseInt(m[0], 10);
  const head = (text || '').slice(0, 400);
  m = head.match(YEAR_RE);
  if (m) return parseInt(m[0], 10);
  return null;
}

function detectSubjects(fileName, text) {
  const head = `${fileName}\n${(text || '').slice(0, 400)}`;
  const found = new Set();
  if (/\bphysics\b/i.test(head)) found.add('Physics');
  if (/\bbiology\b/i.test(head)) found.add('Biology');
  if (/\bchemistry\b/i.test(head)) found.add('Chemistry');
  if (/\bmaths?\b|\bmathematics\b/i.test(head)) found.add('Maths');
  return found;
}

function countStandaloneTF(text) {
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && STANDALONE_TF_RE.test(trimmed)) count++;
  }
  return count;
}

function isBoundaryLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (NUM_BOUNDARY_RE.test(t)) return true;
  return t.length <= 40 && KEYWORD_BOUNDARY_RE.test(t);
}

function splitIntoSegments(text) {
  const lines = text.split(/\r?\n/);
  const boundaries = [];
  lines.forEach((line, idx) => {
    if (isBoundaryLine(line)) boundaries.push(idx);
  });
  if (boundaries.length === 0) return [text];
  const segments = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i];
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : lines.length;
    segments.push(lines.slice(start, end).join('\n'));
  }
  return segments;
}

function countQuestionsInSegment(seg) {
  const numbered = (seg.match(new RegExp(NUMBERED_ITEM_RE, 'gim')) || []).length;
  const answers = (seg.match(/\banswer\s*[:.]|\bans\s*[:.]/gi) || []).length;
  const whoAmI = (seg.match(/who\s+am\s+i/gi) || []).length;
  const tf = countStandaloneTF(seg);
  let count = Math.max(numbered, answers, whoAmI, tf);
  // Some formats (e.g. Speed Race transcripts, single Problem of the Day write-ups) have no
  // numbering or "ANSWER:" label at all - fall back to counting question marks so these
  // don't read as zero questions.
  if (count === 0 && seg.trim().length > 30) {
    const qMarks = (seg.match(/\?/g) || []).length;
    count = qMarks > 0 ? qMarks : 1;
  }
  return count;
}

// Classifies a single segment's round type(s). A segment can match more than one special
// type at once (e.g. true/false statements immediately followed by a riddle under the same
// "Round 5" header), and falls back to "General" only when no special-round keyword matched
// but the segment still shows question/answer structure.
function matchSegmentTypes(seg) {
  const matchedTypes = [];
  if (SPEED_RACE_RE.test(seg)) matchedTypes.push('SpeedRace');
  if (PROBLEM_OF_DAY_RE.test(seg)) matchedTypes.push('ProblemOfDay');
  if (TRUE_FALSE_RE.test(seg) || countStandaloneTF(seg) >= 2) matchedTypes.push('TrueFalse');
  if (RIDDLE_RE.test(seg) || WHO_AM_I_RE.test(seg)) matchedTypes.push('Riddle');

  if (matchedTypes.length === 0) {
    const hasQA = ANSWER_MARKER_RE.test(seg) || NUMBERED_ITEM_RE.test(seg);
    if (hasQA) matchedTypes.push('General');
  }
  return matchedTypes;
}

// Walks CONTEST/ROUND-delimited segments and tags each with matchSegmentTypes().
function analyzeRounds(fileName, text) {
  const roundTypesFound = new Set();
  const perTypeQuestionCounts = Object.fromEntries(ROUND_TYPES.map((t) => [t, 0]));
  const combinedHead = `${fileName}\n${text.slice(0, 400)}`;

  const segments = splitIntoSegments(text);
  for (const seg of segments) {
    const matchedTypes = matchSegmentTypes(seg);
    const segCount = countQuestionsInSegment(seg);
    for (const t of matchedTypes) {
      roundTypesFound.add(t);
      perTypeQuestionCounts[t] += segCount;
    }
  }

  // Filename/title-level fallback: catches docs whose round type is only named in the
  // title (e.g. "... - Speed race.docx") with no per-segment keyword in the body.
  if (SPEED_RACE_RE.test(combinedHead) && !roundTypesFound.has('SpeedRace')) {
    roundTypesFound.add('SpeedRace');
    perTypeQuestionCounts.SpeedRace += countQuestionsInSegment(text);
  }
  if (PROBLEM_OF_DAY_RE.test(combinedHead) && !roundTypesFound.has('ProblemOfDay')) {
    roundTypesFound.add('ProblemOfDay');
    perTypeQuestionCounts.ProblemOfDay += countQuestionsInSegment(text);
  }
  if (TRUE_FALSE_RE.test(combinedHead) && !roundTypesFound.has('TrueFalse')) {
    roundTypesFound.add('TrueFalse');
    perTypeQuestionCounts.TrueFalse += countQuestionsInSegment(text);
  }
  if (RIDDLE_RE.test(combinedHead) && !roundTypesFound.has('Riddle')) {
    roundTypesFound.add('Riddle');
    perTypeQuestionCounts.Riddle += countQuestionsInSegment(text);
  }

  return { roundTypesFound, perTypeQuestionCounts };
}

function classifyDocType(fileName, text, roundTypesFound, subjectsFound) {
  // Threshold of 3+ distinct round types is what separates a genuine full-contest transcript
  // (General + Speed Race + Problem of the Day + True/False + Riddle, in some combination)
  // from a single dedicated round that just happens to combine two sub-parts - e.g. NSMQ's
  // Round 5 is conventionally True/False followed by Riddles, but it's still one round, and
  // nearly every dedicated-round file also carries a "CONTEST N" label, so that alone isn't
  // a reliable full-contest signal.
  if (roundTypesFound.size >= 3) {
    return 'full-contest';
  }
  if (subjectsFound.size > 0) {
    return 'subject-specific';
  }
  return 'dedicated-round';
}

function approxQuestionCount(text) {
  return countQuestionsInSegment(text);
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .sort();

  const rows = [];
  const summary = {
    docTypeCounts: {},
    noYearCount: 0,
    questionCountsByRoundType: Object.fromEntries(ROUND_TYPES.map((t) => [t, 0])),
    unsupportedCount: 0,
    errorCount: 0,
  };

  let processed = 0;
  for (const fileName of files) {
    processed++;
    const filePath = path.join(RAW_DIR, fileName);
    const ext = path.extname(fileName).toLowerCase();

    if (ext !== '.doc' && ext !== '.docx') {
      rows.push({
        file: fileName,
        docType: 'unsupported',
        year: '',
        roundTypesFound: '',
        subjectsFound: '',
        approxQuestionCount: 0,
        error: `unsupported extension ${ext}`,
      });
      summary.unsupportedCount++;
      summary.docTypeCounts.unsupported = (summary.docTypeCounts.unsupported || 0) + 1;
      summary.noYearCount++;
      continue;
    }

    let text;
    try {
      text = await extractText(filePath);
    } catch (err) {
      rows.push({
        file: fileName,
        docType: 'unreadable',
        year: '',
        roundTypesFound: '',
        subjectsFound: '',
        approxQuestionCount: 0,
        error: err.message,
      });
      summary.errorCount++;
      summary.docTypeCounts.unreadable = (summary.docTypeCounts.unreadable || 0) + 1;
      summary.noYearCount++;
      continue;
    }

    const year = detectYear(fileName, text);
    const subjectsFound = detectSubjects(fileName, text);
    const { roundTypesFound, perTypeQuestionCounts } = analyzeRounds(fileName, text);
    const docType = classifyDocType(fileName, text, roundTypesFound, subjectsFound);
    const questionCount = approxQuestionCount(text);

    rows.push({
      file: fileName,
      docType,
      year: year ?? '',
      roundTypesFound: ROUND_TYPES.filter((t) => roundTypesFound.has(t)).join(';'),
      subjectsFound: SUBJECTS.filter((s) => subjectsFound.has(s)).join(';'),
      approxQuestionCount: questionCount,
      error: '',
    });

    summary.docTypeCounts[docType] = (summary.docTypeCounts[docType] || 0) + 1;
    if (!year) summary.noYearCount++;
    for (const t of ROUND_TYPES) {
      summary.questionCountsByRoundType[t] += perTypeQuestionCounts[t];
    }

    if (processed % 50 === 0) {
      console.log(`...processed ${processed}/${files.length}`);
    }
  }

  const header = [
    'file',
    'docType',
    'year',
    'roundTypesFound',
    'subjectsFound',
    'approxQuestionCount',
    'error',
  ];
  const csvLines = [header.join(',')];
  for (const row of rows) {
    csvLines.push(header.map((h) => csvEscape(row[h])).join(','));
  }
  fs.writeFileSync(OUT_CSV, csvLines.join('\n') + '\n', 'utf8');

  console.log(`\nWrote ${rows.length} rows to ${path.relative(process.cwd(), OUT_CSV)}`);

  console.log('\n=== Counts by docType ===');
  for (const [type, count] of Object.entries(summary.docTypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log(`\n=== Files with no year detected: ${summary.noYearCount} / ${rows.length} ===`);

  console.log('\n=== Approx question counts by round type (across whole folder) ===');
  for (const t of ROUND_TYPES) {
    console.log(`  ${t}: ${summary.questionCountsByRoundType[t]}`);
  }

  console.log(
    `\n(unsupported files: ${summary.unsupportedCount}, unreadable/errored files: ${summary.errorCount})`
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  RAW_DIR,
  OUT_CSV,
  ROUND_TYPES,
  SUBJECTS,
  extractText,
  detectYear,
  detectSubjects,
  countStandaloneTF,
  isBoundaryLine,
  splitIntoSegments,
  matchSegmentTypes,
  analyzeRounds,
  classifyDocType,
  countQuestionsInSegment,
  approxQuestionCount,
  SPEED_RACE_RE,
  PROBLEM_OF_DAY_RE,
  TRUE_FALSE_RE,
  RIDDLE_RE,
  WHO_AM_I_RE,
  ANSWER_MARKER_RE,
  NUMBERED_ITEM_RE,
};
