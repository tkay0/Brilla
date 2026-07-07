#!/usr/bin/env node
// Spot-check tool for classify-questions.js's segmentation: pulls every segment tagged
// "General" across the whole corpus, randomly samples 20 of them spread across as many
// distinct source files as possible, and prints each one's full raw text plus any
// near-miss keywords/headers that were nearby but didn't trigger a round-type match.

const fs = require('fs');
const path = require('path');
const {
  RAW_DIR,
  extractText,
  splitIntoSegments,
  matchSegmentTypes,
  countStandaloneTF,
} = require('./classify-questions');

const OUT_FILE = path.join(__dirname, '..', 'content', 'general-sample-check.txt');
const SAMPLE_SIZE = 20;

function headerLineOf(segmentText) {
  const firstLine = segmentText.split(/\r?\n/).find((l) => l.trim().length > 0);
  return firstLine ? firstLine.trim() : '(blank segment)';
}

// Looks for the individual component words of each special-round regex within a General
// segment. Since a full match on any of these would have already pulled the segment out of
// "General", anything found here is by definition a partial/near-miss signal.
function nearMissKeywords(seg) {
  const notes = [];

  const hasSpeed = /\bspeed\b/i.test(seg);
  const hasRace = /\brace\b/i.test(seg);
  if (hasSpeed && hasRace) {
    notes.push('"speed" and "race" both present but not adjacent as "speed race"');
  } else if (hasSpeed) {
    notes.push('"speed" present without "race" nearby');
  } else if (hasRace) {
    notes.push('"race" present without "speed" nearby');
  }

  const hasProblem = /\bproblem\b/i.test(seg);
  const hasDay = /\bday\b/i.test(seg);
  if (hasProblem && hasDay) {
    notes.push('"problem" and "day" both present but not forming "problem of the day"');
  } else if (hasProblem) {
    notes.push('"problem" present without "day" nearby');
  } else if (hasDay) {
    notes.push('"day" present without "problem" nearby');
  }

  const hasTrue = /\btrue\b/i.test(seg);
  const hasFalse = /\bfalse\b/i.test(seg);
  const tfCount = countStandaloneTF(seg);
  if (hasTrue || hasFalse) {
    const words = [hasTrue && 'true', hasFalse && 'false'].filter(Boolean).join('"/"');
    notes.push(
      `"${words}" present but phrase "true...false" not found (standalone T/F line count: ${tfCount}, threshold is 2)`
    );
  } else if (tfCount === 1) {
    notes.push('exactly 1 standalone T/F line found (threshold to count as TrueFalse is 2)');
  }

  // Riddle and "who am i" have no partial form - RIDDLE_RE/WHO_AM_I_RE match any occurrence
  // at all, so their presence would already have excluded this segment from General.

  return notes;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .filter((f) => ['.doc', '.docx'].includes(path.extname(f).toLowerCase()))
    .sort();

  // fileName -> array of { segIndex, text, prevHeader, nextHeader }
  const generalByFile = new Map();

  let processed = 0;
  for (const fileName of files) {
    processed++;
    let text;
    try {
      text = await extractText(path.join(RAW_DIR, fileName));
    } catch (err) {
      continue;
    }
    if (!text) continue;

    const segments = splitIntoSegments(text);
    const generals = [];
    segments.forEach((seg, idx) => {
      if (matchSegmentTypes(seg).includes('General')) {
        generals.push({
          segIndex: idx,
          text: seg,
          prevHeader: idx > 0 ? headerLineOf(segments[idx - 1]) : null,
          nextHeader: idx < segments.length - 1 ? headerLineOf(segments[idx + 1]) : null,
        });
      }
    });
    if (generals.length > 0) {
      generalByFile.set(fileName, generals);
    }

    if (processed % 50 === 0) {
      console.log(`...scanned ${processed}/${files.length}`);
    }
  }

  const totalGeneralSegments = [...generalByFile.values()].reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  // Spread the sample across distinct files: shuffle file order, shuffle each file's own
  // segments, then round-robin one pick per file per pass until we hit SAMPLE_SIZE. This
  // guarantees max file diversity - only reaches into a second segment from the same file
  // once every file with a General segment has already contributed one.
  const fileNames = shuffle([...generalByFile.keys()]);
  const perFileQueues = new Map(fileNames.map((f) => [f, shuffle(generalByFile.get(f))]));

  const sample = [];
  let round = 0;
  while (sample.length < SAMPLE_SIZE) {
    let addedThisRound = false;
    for (const fileName of fileNames) {
      if (sample.length >= SAMPLE_SIZE) break;
      const queue = perFileQueues.get(fileName);
      if (queue.length > round) {
        sample.push({ file: fileName, ...queue[round] });
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break; // every segment across every file has been used
    round++;
  }

  const lines = [];
  const log = (s = '') => {
    console.log(s);
    lines.push(s);
  };

  log('General-segment sample check');
  log(`Generated: ${new Date().toISOString()}`);
  log(
    `Sampled ${sample.length} of ${totalGeneralSegments} total General segments, drawn from ${
      new Set(sample.map((s) => s.file)).size
    } distinct files (${generalByFile.size} files have at least one General segment).`
  );
  log('='.repeat(80));

  sample.forEach((s, i) => {
    log('');
    log(`--- Sample ${i + 1}/${sample.length} ---`);
    log(`File: ${s.file}`);
    log(`Segment index in doc: ${s.segIndex}`);
    log(`Previous segment header: ${s.prevHeader ?? '(none - first segment in doc)'}`);
    log(`Next segment header: ${s.nextHeader ?? '(none - last segment in doc)'}`);
    const nearMiss = nearMissKeywords(s.text);
    log(
      `Near-miss keywords within segment: ${
        nearMiss.length ? nearMiss.join('; ') : '(none found)'
      }`
    );
    log('Segment text:');
    log('-'.repeat(80));
    log(s.text);
    log('-'.repeat(80));
  });

  fs.writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(`\nWrote sample check to ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
