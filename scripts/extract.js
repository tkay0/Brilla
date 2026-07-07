#!/usr/bin/env node
// Stage 2 pilot extraction: turns Stage 1's segment-level classification into individual
// structured questions for exactly two hand-picked files (one riddle-type doc, one
// full-contest doc), so extraction quality can be reviewed before wiring this up to the
// full 300+ file corpus and content/manifest.json.
//
// Pilot files (chosen from content/question-classification.csv for clean, unambiguous
// formatting):
//   - "Biology Riddles (2) - Copy.docx"  - dedicated Riddle doc, 36 clean "Contest N /
//     clues / WHO AM I? <answer>" entries, single subject (Biology).
//   - "CHEMISTRY TRIAL QUIZ.docx"        - full-contest doc (General, Speed Race,
//     True/False, Riddle - no Problem of the Day in this particular file), all sections
//     use consistent "ANSWER:"/"Ans:" markers with no OCR garbling.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  RAW_DIR,
  extractText,
  splitIntoSegments,
  matchSegmentTypes,
  detectSubjects,
} = require('./classify-questions');

const OUT_DIR = path.join(__dirname, '..', 'content', 'seed-data');

const PILOT_FILES = ['CHEMISTRY TRIAL QUIZ.docx', 'Biology Riddles (2) - Copy.docx'];

// ---------------------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------------------

// Segments from Stage 1 always begin with their boundary/header line (e.g. "SPEED RACE",
// "CONTEST 1"). Strip just that first non-blank line to get the segment's body.
function stripHeader(segmentText) {
  const lines = segmentText.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length) i++;
  return lines.slice(i).join('\n');
}

function splitBlocks(bodyText) {
  return bodyText
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
}

// Collapse whitespace only - keeps punctuation intact, for question/clue text.
function cleanText(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// Collapse whitespace and strip trailing separator artifacts (runs of "…"/"." left over
// from a doc's "………" divider line merging onto the same line as an answer) and a single
// trailing punctuation mark, for final answer values.
function cleanAnswer(s) {
  return s
    .replace(/\s+/g, ' ')
    .replace(/[.…]{2,}\s*$/g, '')
    .replace(/[.,;]\s*$/g, '')
    .trim();
}

const ANSWER_PREFIX_RE = /^(?:ANSWER|ANS)[:.\t ]*/i;
const ANSWER_BLOCK_RE = new RegExp(ANSWER_PREFIX_RE.source, 'i');
const ANSWER_LINE_RE = new RegExp(`${ANSWER_PREFIX_RE.source}(.*)$`, 'i');
const PREAMBLE_BLOCK_RE = /^PREAMBLE[:.\t ]*/i;
const REASON_BLOCK_RE = /^REASON[:.\t ]*/i;
const WHO_RE = /who\s+(?:am\s+i|are\s+we)\??/i;
// A block continues the previous ANSWER block rather than starting a new question when it's
// a short calculation-step fragment ("= 4.74/2 + 0.5", "pH = 14 - 2.87") - i.e. it contains
// an "=" within its first ~20 characters and isn't long enough to be its own sentence.
const CALC_CONTINUATION_RE = /^.{0,20}=/;
// A pending question block that starts with a real question/imperative verb and has more
// than a few words is a self-contained new question, not part of a running preamble group
// (e.g. "What is chromatography?" shouldn't inherit a preamble two questions back).
const STANDALONE_QUESTION_START_RE =
  /^(what|which|how|why|when|where|who|explain|describe|state|give|calculate|find|determine|name|identify|define)\b/i;

// Manual fixups for the handful of raw answers in this pilot that need more than generic
// cleanup (a multi-line worked calculation, or a "Reason:"/parenthetical aside that isn't
// part of the actual answer). Matched against the *raw* answer text before cleanAnswer().
// Small and pilot-specific by design - see the note in generateDistractors() below for why
// this is the right tradeoff at this scale.
const ANSWER_TEXT_OVERRIDES = [
  { match: /^pOH\s*=/i, clean: () => '11.13' },
  { match: /^Haber\s+Process/i, clean: () => 'Haber Process' },
  { match: /^Sun\s*\(/i, clean: () => 'Sun' },
];

function resolveAnswerText(rawAnswer) {
  const override = ANSWER_TEXT_OVERRIDES.find((o) => o.match.test(rawAnswer.trim()));
  if (override) return override.clean(rawAnswer);
  return cleanAnswer(rawAnswer);
}

// ---------------------------------------------------------------------------------------
// Segment -> question/answer block parsing (General, ProblemOfDay, SpeedRace, TrueFalse)
// ---------------------------------------------------------------------------------------

// Splits a segment body into {questionText, answerText} pairs. Blocks that start with
// "PREAMBLE:" set shared context that gets prepended to every following question until the
// next preamble - matches the source format where one preamble introduces several
// sub-questions (e.g. "Which of the following are not composed of sub-particles?" followed
// by three short options, each with its own answer).
function parseQABlocks(bodyText) {
  const blocks = splitBlocks(bodyText);
  const pairs = [];
  const warnings = [];
  let pendingQuestionParts = [];
  let preamble = null;
  let lastPair = null;

  for (const block of blocks) {
    if (PREAMBLE_BLOCK_RE.test(block)) {
      preamble = block.replace(PREAMBLE_BLOCK_RE, '').trim();
      continue;
    }
    if (ANSWER_BLOCK_RE.test(block)) {
      const rawAnswer = block.replace(ANSWER_BLOCK_RE, '').trim();
      if (pendingQuestionParts.length === 0) {
        warnings.push(`Answer block with no preceding question: "${block.slice(0, 60)}..."`);
        lastPair = null;
        continue;
      }
      let questionText = pendingQuestionParts.join(' ').trim();
      if (preamble) questionText = `${preamble} ${questionText}`;
      lastPair = { questionText: cleanText(questionText), answerText: rawAnswer };
      pairs.push(lastPair);
      pendingQuestionParts = [];
      continue;
    }
    if (REASON_BLOCK_RE.test(block)) {
      // Supplementary reasoning for the answer just paired - not part of the next question.
      if (lastPair) lastPair.answerText += ` ${block.replace(REASON_BLOCK_RE, '').trim()}`;
      continue;
    }
    if (lastPair && CALC_CONTINUATION_RE.test(block)) {
      // A worked-calculation continuation line (e.g. mammoth inserted blank lines between
      // steps of a multi-line equation) - extend the answer we just paired, don't start a
      // new question.
      lastPair.answerText += ` ${block}`;
      continue;
    }
    lastPair = null;
    if (preamble && pendingQuestionParts.length === 0 && STANDALONE_QUESTION_START_RE.test(block)) {
      preamble = null;
    }
    pendingQuestionParts.push(block);
  }

  if (pendingQuestionParts.length > 0) {
    warnings.push(
      `Trailing question with no answer found: "${pendingQuestionParts.join(' ').slice(0, 60)}..."`
    );
  }

  return { pairs, warnings };
}

// ---------------------------------------------------------------------------------------
// Riddle-specific parsing
// ---------------------------------------------------------------------------------------

// Handles both riddle formats seen in this corpus: "WHO AM I?" (or "WHO ARE WE?") as its
// own line followed by a separate "ANSWER:" line, and "... bauxite. Who am I?" inline at
// the end of the last clue line with the answer on the very next line.
function parseRiddleSegment(segmentText) {
  const body = stripHeader(segmentText);
  const rawLines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let whoLineIdx = -1;
  let beforeWho = '';
  let afterWho = '';

  for (let i = 0; i < rawLines.length; i++) {
    const m = rawLines[i].match(WHO_RE);
    if (m) {
      whoLineIdx = i;
      beforeWho = rawLines[i].slice(0, m.index).trim();
      afterWho = rawLines[i].slice(m.index + m[0].length).trim();
      break;
    }
  }
  if (whoLineIdx === -1) return null;

  const clueLines = rawLines.slice(0, whoLineIdx);
  if (beforeWho) clueLines.push(beforeWho);

  let rawAnswer = afterWho.replace(/^[-:.\s]+/, '').trim();
  if (!rawAnswer) {
    for (let i = whoLineIdx + 1; i < rawLines.length; i++) {
      const m = rawLines[i].match(ANSWER_LINE_RE);
      if (m) {
        rawAnswer = m[1].trim();
        break;
      }
      break; // first non-blank line after "who am i" wasn't an answer line - give up
    }
  }
  if (!rawAnswer) return null;

  const clues = clueLines.map((text, idx) => ({ order: idx + 1, text: cleanText(text) }));
  const questionText = `${clues.map((c) => c.text).join(' ')} Who am I?`;
  return { clues, questionText, answerText: resolveAnswerText(rawAnswer) };
}

// ---------------------------------------------------------------------------------------
// Subject inference
// ---------------------------------------------------------------------------------------

const SUBJECT_KEYWORDS = {
  Physics: [
    'force', 'velocity', 'acceleration', 'energy', 'current', 'voltage', 'circuit',
    'wave', 'frequency', 'momentum', 'charge', 'magnetic', 'motion', 'friction',
    'pressure', 'refractive', 'lens', 'newton', 'joule', 'radioactivity', 'nuclear',
  ],
  Biology: [
    'cell', 'organism', 'plant', 'animal', 'gene', 'protein', 'enzyme', 'tissue',
    'species', 'ecosystem', 'photosynthesis', 'respiration', 'chromosome', 'dna',
    'taxonomy', 'blood', 'nerve', 'muscle', 'reproduction', 'hormone', 'digestion',
    'evolution', 'cavity', 'membrane', 'phylum', 'genotype', 'phenotype', 'meiosis',
    'mitosis', 'gamete', 'metabolic', 'biological', 'biology',
  ],
  Chemistry: [
    'reaction', 'compound', 'element', 'acid', 'base', 'mole', 'moldm', 'solution',
    'bond', 'molecule', 'oxidation', 'reduction', 'ion', 'isotope', 'periodic',
    'electrolysis', 'catalyst', 'ph', 'chromatography', 'anhydride', 'chloride',
    'chemistry', 'chemical', 'metal', 'alloy',
  ],
  Maths: [
    'equation', 'function', 'integral', 'derivative', 'probability', 'sequence',
    'matrix', 'polynomial', 'geometry', 'angle', 'triangle', 'differentiate',
    'trigonometric', 'logarithm', 'factorise', 'simplify',
  ],
};

// Word-boundary match with a tolerated trailing "s"/"es" so plurals ("plants", "gametes")
// still count - a bare \b...\b would otherwise miss every plural, since strict word-boundary
// matching (needed to stop "ion" matching inside "reactions") is exact by default.
function countKeywordHits(lower, words) {
  return words.reduce(
    (acc, w) =>
      acc + (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}e?s?\\b`, 'i').test(lower) ? 1 : 0),
    0
  );
}

// Word-boundary keyword matching (not naive substring - "ion" must not match inside
// "reactions", "gene" must not match inside "general"). A file-level subject hint (from
// Stage 1's filename/title detection, e.g. "Biology Riddles...") is trusted whenever it
// scores at least one content hit of its own, and overridden only when it scores zero -
// i.e. content-based inference is a fallback for when the hint clearly doesn't fit, not a
// competitor that outvotes the hint. A simple highest-score-wins comparison misfires too
// often on borderline biochemistry vocabulary: a biology riddle about Acetyl-CoA mentions
// "protein" (1 Biology hit) but also "reaction(s)", "acid", "molecule(s)" and "chemical"
// (4 Chemistry hits), so any margin-based override still flips it to Chemistry incorrectly.
function inferSubject(text, fileHint) {
  const lower = text.toLowerCase();
  const scores = Object.fromEntries(
    Object.entries(SUBJECT_KEYWORDS).map(([subject, words]) => [subject, countKeywordHits(lower, words)])
  );
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topSubject, topScore] = ranked[0];

  if (!fileHint) return topScore > 0 ? topSubject : null;

  const hintScore = scores[fileHint] || 0;
  if (topSubject !== fileHint && hintScore === 0 && topScore > 0) return topSubject;
  return fileHint;
}

// ---------------------------------------------------------------------------------------
// Distractor generation
// ---------------------------------------------------------------------------------------
// Two paths, per the task's methodology:
//  - numeric answers: algorithmic, mechanical calculation-error transforms (decimal shift,
//    sign/variable-confusion flip, a plausible arithmetic slip). This is genuinely reusable
//    beyond this pilot since it needs no domain knowledge.
//  - conceptual/entity answers: "genuine near-neighbors in the same category" requires real
//    domain judgment (e.g. the other three ruminant stomach chambers for "Reticulum", the
//    other cranial nerves for "Olfactory nerve") that a keyword heuristic can't produce
//    reliably. With only 41 scored questions in this pilot, hand-curating every one gives
//    much higher quality than a generic algorithm would - each entry below was chosen for
//    genuinely being in the same category/domain as its correct answer, not picked at
//    random. CONCEPTUAL_FALLBACK_POOLS is a coarse safety net for anything not covered by
//    an override, kept so the function still produces a full options array if this script
//    is later pointed at unreviewed files - not something this pilot run actually exercises.

function normalizeKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const DISTRACTOR_OVERRIDES = Object.fromEntries(
  [
    ['Primary productivity', ['Secondary productivity', 'Net productivity', 'Trophic efficiency']],
    ['(Cellular) Respiration', ['Fermentation', 'Glycolysis', 'Photosynthesis']],
    ['Acetyl coenzyme A or acetyl-CoA', ['Pyruvate', 'Citrate', 'NADH']],
    ['"Bird of prey"', ['Wading bird', 'Songbird', 'Game bird']],
    ['Crossing Over', ['Independent assortment', 'Nondisjunction', 'Synapsis']],
    ['Habitat fragmentation', ['Habitat degradation', 'Biodiversity loss', 'Desertification']],
    ['Swallowing', ['Peristalsis', 'Mastication', 'Regurgitation']],
    ['Isogamy', ['Anisogamy', 'Oogamy', 'Conjugation']],
    ['Larva', ['Pupa', 'Nymph', 'Zygote']],
    ['Pericycle', ['Endodermis', 'Cortex', 'Epidermis']],
    ['Gametophyte', ['Sporophyte', 'Zygote', 'Spore']],
    ['Sea horse', ['Pipefish', 'Sea dragon', 'Sea cucumber']],
    ['Genotype', ['Phenotype', 'Karyotype', 'Allele']],
    ['Class', ['Order', 'Family', 'Phylum']],
    ['Reticulum', ['Rumen', 'Omasum', 'Abomasum']],
    ['Capillary', ['Arteriole', 'Venule', 'Artery']],
    ['Vitamin A', ['Vitamin D', 'Vitamin E', 'Vitamin K']],
    ['Goitre', ['Hyperthyroidism', 'Hypothyroidism', "Grave's disease"]],
    ['Self-pollination', ['Cross-pollination', 'Self-fertilization', 'Vegetative propagation']],
    ['Ferns', ['Mosses', 'Liverworts', 'Horsetails']],
    ['Bony fish/ Bony fishes', ['Cartilaginous fish', 'Jawless fish', 'Lobe-finned fish']],
    ['Muscle', ['Tendon', 'Ligament', 'Cartilage']],
    ['Olfactory nerve', ['Optic nerve', 'Trigeminal nerve', 'Vagus nerve']],
    ['Petiole / Leaf stalk', ['Stipule', 'Lamina', 'Rachis']],
    ['Coevolution', ['Convergent evolution', 'Divergent evolution', 'Adaptive radiation']],
    ['Binomial Nomenclature', ['Taxonomic classification', 'Phylogenetics', 'Cladistics']],
    ['Anatomy', ['Physiology', 'Histology', 'Morphology']],
    ['Species', ['Genus', 'Subspecies', 'Population']],
    ['Marine Ecosystem', ['Freshwater ecosystem', 'Estuarine ecosystem', 'Terrestrial ecosystem']],
    ['Lichen', ['Moss', 'Algae', 'Fungus']],
    ['Abdominal cavity', ['Thoracic cavity', 'Pelvic cavity', 'Cranial cavity']],
    ['Metamerism', ['Segmentation', 'Tagmosis', 'Polymerism']],
    ['Seed', ['Spore', 'Pollen', 'Ovule']],
    ['Cell wall', ['Cell membrane', 'Cytoskeleton', 'Cuticle']],
    ['Amoeboid (movement)', ['Ciliary movement', 'Flagellar movement', 'Peristalsis']],
    ['Cell division', ['Mitosis', 'Meiosis', 'Binary fission']],
    [
      'Bromine atoms are bigger and heavier therefore bromine molecules experience greater intermolecular forces.',
      [
        'Chlorine atoms are bigger and heavier therefore chlorine molecules experience greater intermolecular forces.',
        'Bromine has a higher electronegativity than chlorine, resulting in stronger dipole-dipole forces.',
        'Bromine forms hydrogen bonds while chlorine does not.',
      ],
    ],
    ['Haber Process', ['Contact Process', 'Ostwald Process', 'Solvay Process']],
    ['Sun', ['Moon', 'Star', 'Light']],
    ['Aluminium', ['Iron', 'Magnesium', 'Sodium']],
  ].map(([answer, distractors]) => [normalizeKey(answer), distractors])
);

const CONCEPTUAL_FALLBACK_POOLS = {
  Biology: ['Enzyme', 'Chromosome', 'Ecosystem', 'Organelle', 'Hormone'],
  Chemistry: ['Catalyst', 'Isotope', 'Electrolyte', 'Alkane', 'Buffer'],
  Physics: ['Momentum', 'Refraction', 'Resistance', 'Torque', 'Amplitude'],
  Maths: ['Polynomial', 'Derivative', 'Matrix', 'Asymptote', 'Coefficient'],
};

function isNumericAnswer(raw) {
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z%°/^\d-]*)$/);
  return m ? { value: parseFloat(m[1]), unit: m[2] || '' } : null;
}

function formatNum(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function generateNumericDistractors(value, unit) {
  const out = new Set();
  const shifted = Math.abs(value) >= 1 ? value / 10 : value * 10;
  out.add(`${formatNum(shifted)}${unit}`);
  out.add(`${formatNum(-value)}${unit}`);
  const slipAmount = Math.max(1, Math.round(Math.abs(value) * 0.15));
  out.add(`${formatNum(value + (value >= 0 ? 1 : -1) * slipAmount)}${unit}`);
  return [...out].slice(0, 3);
}

function generateConceptualDistractors(correctAnswer, subject) {
  const key = normalizeKey(correctAnswer);
  if (DISTRACTOR_OVERRIDES[key]) return DISTRACTOR_OVERRIDES[key];

  const pool = (CONCEPTUAL_FALLBACK_POOLS[subject] || []).filter(
    (term) => normalizeKey(term) !== key
  );
  const picked = [];
  const used = new Set();
  while (picked.length < 3 && picked.length < pool.length) {
    const candidate = pool[Math.floor(Math.random() * pool.length)];
    if (!used.has(candidate)) {
      used.add(candidate);
      picked.push(candidate);
    }
  }
  while (picked.length < 3) picked.push(`(no near-neighbor distractor available for "${correctAnswer}")`);
  return picked;
}

function generateDistractors(correctAnswer, subject) {
  const numeric = isNumericAnswer(correctAnswer);
  return numeric
    ? generateNumericDistractors(numeric.value, numeric.unit)
    : generateConceptualDistractors(correctAnswer, subject);
}

// ---------------------------------------------------------------------------------------
// Cloze (fill-in-the-blank) detection for Problem of the Day - untested by this pilot run
// since neither chosen file contains a Problem of the Day segment, but implemented per spec
// so the code path exists for when a cloze-format doc is fed through this script.
// ---------------------------------------------------------------------------------------

const CLOZE_BLANK_RE = /_{3,}|\[\s*blank\s*\d*\s*\]/gi;

function tryParseCloze(questionText, answerText) {
  const blanks = [...questionText.matchAll(CLOZE_BLANK_RE)];
  if (blanks.length === 0) return null;
  const answerParts = answerText
    .split(/[;,]|\d+[.)]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (answerParts.length !== blanks.length) return null;
  return {
    passageText: questionText,
    blanks: answerParts.map((answer, idx) => ({ order: idx + 1, answer: cleanAnswer(answer) })),
  };
}

// ---------------------------------------------------------------------------------------
// Segment -> question objects, per round type
// ---------------------------------------------------------------------------------------

function buildBase(fileName, subject) {
  return { id: crypto.randomUUID(), sourceFile: fileName, subject };
}

function extractGeneral(fileName, segmentText, fileSubjectHint, warnings) {
  const { pairs, warnings: qaWarnings } = parseQABlocks(stripHeader(segmentText));
  warnings.push(...qaWarnings.map((w) => `[General] ${w}`));
  return pairs.map(({ questionText, answerText }) => ({
    ...buildBase(fileName, inferSubject(`${questionText} ${answerText}`, fileSubjectHint)),
    questionText,
    correctAnswer: resolveAnswerText(answerText),
    scored: false,
  }));
}

function extractProblemOfDay(fileName, segmentText, fileSubjectHint, warnings) {
  const { pairs, warnings: qaWarnings } = parseQABlocks(stripHeader(segmentText));
  warnings.push(...qaWarnings.map((w) => `[ProblemOfDay] ${w}`));
  return pairs.map(({ questionText, answerText }) => {
    const subject = inferSubject(`${questionText} ${answerText}`, fileSubjectHint);
    const cloze = tryParseCloze(questionText, answerText);
    if (cloze) {
      return { ...buildBase(fileName, subject), ...cloze, scored: false };
    }
    return {
      ...buildBase(fileName, subject),
      questionText,
      correctAnswer: resolveAnswerText(answerText),
      scored: false,
    };
  });
}

function extractSpeedRace(fileName, segmentText, fileSubjectHint, warnings) {
  const { pairs, warnings: qaWarnings } = parseQABlocks(stripHeader(segmentText));
  warnings.push(...qaWarnings.map((w) => `[SpeedRace] ${w}`));
  return pairs.map(({ questionText, answerText }) => {
    const subject = inferSubject(`${questionText} ${answerText}`, fileSubjectHint);
    const correctAnswer = resolveAnswerText(answerText);
    return {
      ...buildBase(fileName, subject),
      questionText,
      correctAnswer,
      options: shuffleOptions(correctAnswer, generateDistractors(correctAnswer, subject)),
      scored: true,
    };
  });
}

function extractTrueFalse(fileName, segmentText, fileSubjectHint, warnings) {
  const { pairs, warnings: qaWarnings } = parseQABlocks(stripHeader(segmentText));
  warnings.push(...qaWarnings.map((w) => `[TrueFalse] ${w}`));
  const out = [];
  for (const { questionText, answerText } of pairs) {
    const m = answerText.trim().match(/^(true|false)\b/i);
    if (!m) {
      warnings.push(`[TrueFalse] Could not parse boolean from answer: "${answerText.slice(0, 40)}..."`);
      continue;
    }
    out.push({
      ...buildBase(fileName, inferSubject(questionText, fileSubjectHint)),
      questionText,
      correctAnswer: m[1].toLowerCase() === 'true',
      scored: true,
    });
  }
  return out;
}

function extractRiddle(fileName, segmentText, fileSubjectHint, warnings) {
  const parsed = parseRiddleSegment(segmentText);
  if (!parsed) {
    warnings.push(`[Riddle] Could not find a "who am i"/answer pair in segment: "${segmentText.slice(0, 60)}..."`);
    return [];
  }
  const { clues, questionText, answerText } = parsed;
  const subject = inferSubject(`${questionText} ${answerText}`, fileSubjectHint);
  return [
    {
      ...buildBase(fileName, subject),
      questionText,
      correctAnswer: answerText,
      options: shuffleOptions(answerText, generateDistractors(answerText, subject)),
      clues,
      scored: true,
    },
  ];
}

function shuffleOptions(correctAnswer, distractors) {
  const options = [correctAnswer, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

// ---------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const buckets = { General: [], SpeedRace: [], ProblemOfDay: [], TrueFalse: [], Riddle: [] };
  const allWarnings = [];

  for (const fileName of PILOT_FILES) {
    const filePath = path.join(RAW_DIR, fileName);
    const text = await extractText(filePath);
    const fileSubjectHint = [...detectSubjects(fileName, text)][0] || null;
    const segments = splitIntoSegments(text);

    for (const segment of segments) {
      const matchedTypes = matchSegmentTypes(segment);
      if (matchedTypes.length === 0) {
        allWarnings.push(
          `[${fileName}] Segment matched no round type, skipped: "${segment.slice(0, 60).replace(/\n/g, ' ')}..."`
        );
        continue;
      }
      for (const type of matchedTypes) {
        const warnings = [];
        let questions = [];
        if (type === 'General') questions = extractGeneral(fileName, segment, fileSubjectHint, warnings);
        else if (type === 'ProblemOfDay')
          questions = extractProblemOfDay(fileName, segment, fileSubjectHint, warnings);
        else if (type === 'SpeedRace')
          questions = extractSpeedRace(fileName, segment, fileSubjectHint, warnings);
        else if (type === 'TrueFalse')
          questions = extractTrueFalse(fileName, segment, fileSubjectHint, warnings);
        else if (type === 'Riddle') questions = extractRiddle(fileName, segment, fileSubjectHint, warnings);

        buckets[type].push(...questions);
        allWarnings.push(...warnings.map((w) => `[${fileName}] ${w}`));
      }
    }
  }

  const fileMap = {
    General: 'general.json',
    SpeedRace: 'speed-race.json',
    ProblemOfDay: 'problem-of-the-day.json',
    TrueFalse: 'true-false.json',
    Riddle: 'riddles.json',
  };

  for (const [type, outFile] of Object.entries(fileMap)) {
    const outPath = path.join(OUT_DIR, outFile);
    fs.writeFileSync(outPath, JSON.stringify(buckets[type], null, 2) + '\n', 'utf8');
  }

  printSummary(buckets, allWarnings);
}

function printSummary(buckets, warnings) {
  const line = (s = '') => console.log(s);

  line('='.repeat(90));
  line('STAGE 2 PILOT EXTRACTION SUMMARY');
  line('='.repeat(90));
  line(`Files processed: ${PILOT_FILES.join(', ')}`);
  line(
    `Question counts: General ${buckets.General.length}, SpeedRace ${buckets.SpeedRace.length}, ` +
      `ProblemOfDay ${buckets.ProblemOfDay.length}, TrueFalse ${buckets.TrueFalse.length}, ` +
      `Riddle ${buckets.Riddle.length}`
  );
  line();

  for (const [type, questions] of Object.entries(buckets)) {
    line('-'.repeat(90));
    line(`${type} (${questions.length})`);
    line('-'.repeat(90));
    if (questions.length === 0) {
      line('  (none found in the pilot files)');
    }
    questions.forEach((q, i) => {
      line(`${i + 1}. [${q.subject || 'unknown subject'}] (${q.sourceFile})`);
      if (q.passageText) {
        line(`   Passage: ${q.passageText}`);
        line(`   Blanks: ${q.blanks.map((b) => `#${b.order}=${b.answer}`).join(', ')}`);
      } else {
        line(`   Q: ${q.questionText}`);
        if (typeof q.correctAnswer === 'boolean') {
          line(`   Answer: ${q.correctAnswer}`);
        } else {
          line(`   Answer: ${q.correctAnswer}`);
        }
        if (q.clues) {
          line(`   Clues: ${q.clues.map((c) => `(${c.order}) ${c.text}`).join(' | ')}`);
        }
        if (q.options) {
          line(`   Options (shuffled): ${q.options.join(' / ')}`);
          const distractors = q.options.filter((o) => o !== q.correctAnswer);
          line(`   Distractors: ${distractors.join(' | ')}`);
        }
      }
      line(`   scored: ${q.scored}   id: ${q.id}`);
      line();
    });
  }

  line('='.repeat(90));
  line(`WARNINGS (${warnings.length})`);
  line('='.repeat(90));
  if (warnings.length === 0) {
    line('  (none)');
  } else {
    warnings.forEach((w) => line(`  - ${w}`));
  }
  line();
  line(`Wrote output to ${path.relative(process.cwd(), OUT_DIR)}/{general,speed-race,problem-of-the-day,true-false,riddles}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
