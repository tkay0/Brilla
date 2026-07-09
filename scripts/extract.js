#!/usr/bin/env node
// Stage 2 extraction: turns Stage 1's segment-level classification into individual
// structured questions, written incrementally to content/seed-data/*.json and tracked in
// content/manifest.json so re-running is cheap and safe - unchanged files are skipped,
// changed files are reprocessed, and existing question IDs are never regenerated.
//
// Usage:
//   node scripts/extract.js                          process every file in raw-questions
//   node scripts/extract.js --only "a.docx,b.doc"     process just these files
//   node scripts/extract.js --dry-run                 preview only, writes nothing
//
// Files listed in content/known-exceptions.md (questions/answers split across separate
// files or sections, which segment-level parsing can't reassemble) are skipped with a
// single log line instead of producing a pile of parse warnings.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  RAW_DIR,
  extractText,
  splitIntoSegments,
  matchSegmentTypes,
  detectSubjects,
  SPEED_RACE_RE,
  PROBLEM_OF_DAY_RE,
  TRUE_FALSE_RE,
  RIDDLE_RE,
} = require('./classify-questions');

const OUT_DIR = path.join(__dirname, '..', 'content', 'seed-data');
const MANIFEST_PATH = path.join(__dirname, '..', 'content', 'manifest.json');
const KNOWN_EXCEPTIONS_PATH = path.join(__dirname, '..', 'content', 'known-exceptions.md');

const ROUND_TYPE_FILE_MAP = {
  General: 'general.json',
  SpeedRace: 'speed-race.json',
  ProblemOfDay: 'problem-of-the-day.json',
  TrueFalse: 'true-false.json',
  Riddle: 'riddles.json',
};

function zeroCounts() {
  return Object.fromEntries(Object.keys(ROUND_TYPE_FILE_MAP).map((t) => [t, 0]));
}

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

// A line starting with "ANSWER:"/"ANS:" is an unconditional block boundary, even with no
// blank line before it. Roughly half the corpus (see scope-check-blank-line-gaps.js) has
// this label glued directly to the preceding question with no blank-line separator, or has
// the next question's text glued onto the end of an answer block with no separator either -
// relying on blank lines alone silently merges those into one unparseable block.
// Requires a real separator (or end of line, for a bare "ANSWER" label) right after the
// word - not just `[:.\t ]*` - so prose that happens to start a line with "Answering"/
// "Answerable" doesn't get mistaken for the marker and split mid-sentence.
//
// The single-letter "A."/"A:" form (from the "Q. ... / A. ..." transcript files, ~34 of them)
// REQUIRES a "." or ":" immediately after the A - never a bare space - so the article "A "
// starting a sentence ("A ball is thrown ...") and clue lines like "A form of energy" are not
// mistaken for an answer label. It's only recognised at the start of a line (not inline): a
// single letter is far too common mid-sentence ("vitamin A. It ...", "point A.") to split on
// safely, so unlike ANSWER:/ANS: it deliberately has no inline variant.
const BLOCK_ANSWER_BOUNDARY_RE = /^(?:(?:ANSWER|ANS)(?:[:.\t ]|$)|A[.:])/i;
// Those same transcript files have no blank line between a "Q." line and the "A." line that
// follows, nor between an answer and the next "Q." line. Without a question-side boundary too,
// each answer block would swallow the next question (the Pattern 2 failure). So a line starting
// "Q."/"Q:" is also an unconditional block boundary. Same guard: requires "." or ":" so a bare
// "Q " (rare, but e.g. a variable named Q) isn't treated as a marker.
const BLOCK_QUESTION_BOUNDARY_RE = /^Q[.:]/i;
// A line that is nothing but a "SOLUTION" / "SOLUTIONS" heading (optional trailing : or .).
// Used only by the scoped single-question Problem-of-the-Day parser below.
const SOLUTION_STANDALONE_RE = /^\s*SOLUTIONS?\s*[:.]?\s*$/i;

// Some documents put the answer label inline at the END of the question line
// ("Find x if 1 = 125 Ans:-11/2", "... find cos2x    ans: 0") rather than on its own line.
// A break is inserted just before such a mid-line ANSWER:/ANS:/Ans: marker so the block-start
// logic below can treat the answer as its own block. The leading `(\S)[ \t]*` requires a
// non-whitespace char earlier ON THE SAME LINE (\n is whitespace, so it never matches across a
// line start), which limits this to genuinely inline markers and leaves existing
// start-of-line markers untouched. `\b` guards against substrings like "means:", "plans:",
// "Hans:", and the trailing `[:.]` requires a real separator so "answering"/"answerable" prose
// is never split.
const INLINE_ANSWER_MARKER_RE = /(\S)[ \t]*\b((?:ANSWER|ANS)\s*[:.])/gi;

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

// Strips the answer label off the front of an answer block. The single-letter "A."/"A:" form
// requires the "." or ":" (matching BLOCK_ANSWER_BOUNDARY_RE) so it never eats the leading "A "
// of an ordinary answer sentence.
const ANSWER_PREFIX_RE = /^(?:(?:ANSWER|ANS)[:.\t ]*|A[.:][ \t]*)/i;
const ANSWER_BLOCK_RE = new RegExp(ANSWER_PREFIX_RE.source, 'i');
const ANSWER_LINE_RE = new RegExp(`${ANSWER_PREFIX_RE.source}(.*)$`, 'i');
// Strips a leading "Q."/"Q:" question label so it doesn't end up inside the stored question
// text (the transcript files prefix every question with it).
const QUESTION_PREFIX_RE = /^Q[.:][ \t]*/i;
const PREAMBLE_BLOCK_RE = /^PREAMBLE[:.\t ]*/i;
const REASON_BLOCK_RE = /^REASON[:.\t ]*/i;
// Some docs label an answer as "Answer - Contest 14" / "Answer– Contest 19" - just the
// contest number repeated as a trailing label, not actual answer content. The real answer
// follows in later blocks, so this needs to be treated the same as a bare "Answer" label.
const TRAILING_CONTEST_LABEL_RE = /^[-–—]?\s*contest\s*\d+\.?\s*$/i;

function isEffectivelyEmptyAnswer(rawAnswer) {
  return rawAnswer.length === 0 || TRAILING_CONTEST_LABEL_RE.test(rawAnswer);
}
// "1" is accepted alongside "i" in the "am" branch only - a narrow, observed OCR/typo
// substitution ("Who am 1?" instead of "Who am I?"), not a general digit/letter conflation.
const WHO_RE = /who\s+(?:am\s+[i1]|are\s+we)\??/i;
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
  // True once we've seen a bare "Answer"/"ANSWER:" label with nothing after it on the same
  // block - the real answer text is coming in one or more later blocks (blank-line-separated
  // paragraphs), not immediately following like "ANSWER: <text>" does.
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
        // A second "Answer"-labeled block while still collecting the first one's body - treat
        // it as more of the same answer rather than losing track of the pairing.
        if (!effectivelyEmpty) {
          lastPair.answerText += `${lastPair.answerText ? ' ' : ''}${rawAnswer}`;
          collectingEmptyAnswer = false;
        }
        continue;
      }
      if (pendingQuestionParts.length === 0) {
        warnings.push(`Answer block with no preceding question: "${block.slice(0, 60)}..."`);
        lastPair = null;
        collectingEmptyAnswer = false;
        continue;
      }
      let questionText = pendingQuestionParts.join(' ').trim().replace(QUESTION_PREFIX_RE, '');
      if (preamble) questionText = `${preamble} ${questionText}`;
      // Detection only, doesn't change what gets extracted: this block is immediately
      // followed by another answer-led block, with no question block between them - the
      // known "swallowed question" signature (see scope-check-blank-line-gaps.js Pattern 2).
      // That means this pair's answerText below almost certainly has the next question's text
      // glued onto its tail. Flagged so callers can mark the resulting entry rather than
      // silently trusting it - not fed back into any parsing decision here.
      const nextBlock = blocks[idx + 1];
      const possiblyCorrupted = !effectivelyEmpty && nextBlock !== undefined && ANSWER_BLOCK_RE.test(nextBlock);
      // A trailing-contest-label answer ("Answer - Contest 14") carries no real content -
      // discard it rather than storing it as the answer, so it doesn't end up prefixed onto
      // the real answer text collected from later blocks.
      lastPair = {
        questionText: cleanText(questionText),
        answerText: effectivelyEmpty ? '' : rawAnswer,
        possiblyCorrupted,
      };
      pairs.push(lastPair);
      pendingQuestionParts = [];
      collectingEmptyAnswer = effectivelyEmpty;
      continue;
    }
    if (REASON_BLOCK_RE.test(block)) {
      // Supplementary reasoning for the answer just paired - not part of the next question.
      collectingEmptyAnswer = false;
      if (lastPair) lastPair.answerText += ` ${block.replace(REASON_BLOCK_RE, '').trim()}`;
      continue;
    }
    if (collectingEmptyAnswer && lastPair) {
      // A continuation paragraph of a bare "Answer" label's body.
      lastPair.answerText += `${lastPair.answerText ? ' ' : ''}${block}`;
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
    collectingEmptyAnswer = false;
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

// Some riddles number their answer line ("8. ANSWER: Root") - a leftover item marker in
// front of the label the plain prefix check would otherwise miss. Stripped before testing for
// the answer marker, on the answer-line check only (not the inline "...bauxite. Who am I?"
// same-line case, which never carries a numbered prefix in this corpus).
const NUMBERED_ITEM_PREFIX_RE = /^\d{1,3}[.)]\s*/;
function matchAnswerLine(line) {
  return line.replace(NUMBERED_ITEM_PREFIX_RE, '').match(ANSWER_LINE_RE);
}

// A clue-style line in riddle-shaped prose ("I am ...", "I have ...", "My ...", "We are ...").
// Used only by the closing-question fallback below.
const CLUE_STYLE_LINE_RE = /^(?:i\s+am\b|i\s+have\b|i\s+can\b|my\s+\S|we\s+are\b|we\s+have\b)/i;

// Handles the riddle formats seen in this corpus: "WHO AM I?" (or "WHO ARE WE?"/"Who am 1?")
// as its own line followed by a separate "ANSWER:" line, "... bauxite. Who am I?" inline at
// the end of the last clue line with the answer on the very next line, and (fallback) riddle-
// shaped prose that closes with a different question ("What is my systematic name?") instead
// of the standard phrase.
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

  if (whoLineIdx !== -1) {
    const clueLines = rawLines.slice(0, whoLineIdx);
    if (beforeWho) clueLines.push(beforeWho);

    let rawAnswer = afterWho.replace(/^[-:.\s]+/, '').trim();
    if (!rawAnswer) {
      for (let i = whoLineIdx + 1; i < rawLines.length; i++) {
        const m = matchAnswerLine(rawLines[i]);
        if (m) {
          rawAnswer = m[1].trim();
          break;
        }
        break; // first non-blank line after "who am i" wasn't an answer line - give up
      }
    }
    // "who am i" found but no answer followed it anywhere expected - genuine truncation, not
    // something the closing-question fallback below should try to rescue.
    if (!rawAnswer) return null;

    const clues = clueLines.map((text, idx) => ({ order: idx + 1, text: cleanText(text) }));
    const questionText = `${clues.map((c) => c.text).join(' ')} Who am I?`;
    return { clues, questionText, answerText: resolveAnswerText(rawAnswer) };
  }

  // No "who am i"/"who are we" phrase anywhere. Accept a differently-phrased closing question
  // as the prompt when the segment otherwise looks riddle-shaped: at least two "I am"/"My"-
  // style clue lines, ending in a line that asks a question, followed by a recognizable answer
  // line. Deliberately narrow - a bare section-header segment (no clue lines) or one with no
  // question mark at all still falls through and returns null, same as before.
  const clueLineCount = rawLines.filter((l) => CLUE_STYLE_LINE_RE.test(l)).length;
  if (clueLineCount < 2) return null;

  const questionLineIdx = rawLines.reduce((last, l, idx) => (l.endsWith('?') ? idx : last), -1);
  if (questionLineIdx === -1) return null;

  let rawAnswer = '';
  for (let i = questionLineIdx + 1; i < rawLines.length; i++) {
    const m = matchAnswerLine(rawLines[i]);
    if (m) {
      rawAnswer = m[1].trim();
      break;
    }
    break;
  }
  if (!rawAnswer) return null;

  const clueLines = rawLines.slice(0, questionLineIdx);
  const clues = clueLines.map((text, idx) => ({ order: idx + 1, text: cleanText(text) }));
  const questionText = `${clues.map((c) => c.text).join(' ')} ${cleanText(rawLines[questionLineIdx])}`;
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

// Deterministic rather than random: an unchanged question produces the exact same ID on
// every re-run (no cross-run lookup/matching needed to preserve stability), and editing one
// question's text only changes that question's own ID - not its siblings' - unlike the old
// crypto.randomUUID() scheme, where reprocessing a file regenerated every question ID in it
// even if only one question actually changed. sha256 is called via forward reference to the
// sha256() function declared later in this file (safe: function declarations are hoisted).
function questionIdSeed(sourceFile, roundType, text) {
  return `${sourceFile} ${roundType} ${text.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

function buildBase(fileName, subject, roundType, idSeedText) {
  const id = sha256(questionIdSeed(fileName, roundType, idSeedText)).slice(0, 24);
  return { id, sourceFile: fileName, subject };
}

function extractGeneral(fileName, segmentText, fileSubjectHint, warnings) {
  const { pairs, warnings: qaWarnings } = parseQABlocks(stripHeader(segmentText));
  warnings.push(...qaWarnings.map((w) => `[General] ${w}`));
  return pairs.map(({ questionText, answerText, possiblyCorrupted }) => ({
    ...buildBase(fileName, inferSubject(`${questionText} ${answerText}`, fileSubjectHint), 'General', questionText),
    questionText,
    correctAnswer: resolveAnswerText(answerText),
    scored: false,
    ...(possiblyCorrupted ? { possiblyCorrupted: true } : {}),
  }));
}

function extractProblemOfDay(fileName, segmentText, fileSubjectHint, warnings) {
  const { pairs, warnings: qaWarnings } = parseQABlocks(stripHeader(segmentText));
  warnings.push(...qaWarnings.map((w) => `[ProblemOfDay] ${w}`));
  return pairs.map(({ questionText, answerText }) => {
    const subject = inferSubject(`${questionText} ${answerText}`, fileSubjectHint);
    const base = buildBase(fileName, subject, 'ProblemOfDay', questionText);
    const cloze = tryParseCloze(questionText, answerText);
    if (cloze) {
      return { ...base, ...cloze, scored: false };
    }
    return {
      ...base,
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
      ...buildBase(fileName, subject, 'SpeedRace', questionText),
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
  // Some files (e.g. the numbered ROUND 5-* set) abbreviate the answer to a bare "T"/"F"
  // instead of spelling out True/False. The single-letter alternatives are word-boundary
  // guarded the same way as "true"/"false" - "T"/"F" only matches when followed by a
  // non-word character (space, bracket, punctuation, end of string), so it can't match the
  // start of an unrelated word like "Two" or "False" itself is unaffected since "false" is
  // tried first in the alternation.
  const TF_ANSWER_RE = /^(true|false|t|f)\b/i;
  for (const { questionText, answerText, possiblyCorrupted } of pairs) {
    const m = answerText.trim().match(TF_ANSWER_RE);
    if (!m) {
      warnings.push(`[TrueFalse] Could not parse boolean from answer: "${answerText.slice(0, 40)}..."`);
      continue;
    }
    out.push({
      ...buildBase(fileName, inferSubject(questionText, fileSubjectHint), 'TrueFalse', questionText),
      questionText,
      // Compare the first letter, not the whole match, so the single-letter "T"/"F" forms
      // (which don't equal the literal string "true"/"false") are handled the same as the
      // spelled-out forms.
      correctAnswer: /^t/i.test(m[1]),
      scored: true,
      // Same Pattern-2 lookahead as General (see parseQABlocks): this answer is immediately
      // followed by another answer block, so the next statement is very likely glued onto this
      // one's tail. Because TrueFalse is scored, a corrupted statement must never be served to a
      // student, so carry excludeFromServing alongside the flag from creation - Stage 4's
      // serving layer will read it rather than having to recompute it.
      ...(possiblyCorrupted ? { possiblyCorrupted: true, excludeFromServing: true } : {}),
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
      ...buildBase(fileName, subject, 'Riddle', questionText),
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
// Manifest, known-exceptions, and hashing
// ---------------------------------------------------------------------------------------

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function writeManifest(manifest) {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

// Parses the "## Files to skip entirely" section of known-exceptions.md for backtick-quoted
// filenames anchored at the start of a bullet line - deliberately narrow (only the first
// backtick span per "- `...`" line) so a filename mentioned in another bullet's prose (e.g.
// "the answer lives in `CONTEST 40 DIAGRAM.docx`") doesn't get misparsed as its own entry
// unless it also has its own top-level bullet.
function loadKnownExceptions() {
  const fullSkip = new Set();
  if (!fs.existsSync(KNOWN_EXCEPTIONS_PATH)) return { fullSkip };

  const md = fs.readFileSync(KNOWN_EXCEPTIONS_PATH, 'utf8');
  const sections = md.split(/^## /m).slice(1); // drop preamble before the first ## heading
  const target = sections.find((s) => s.startsWith('Files to skip entirely'));
  if (!target) return { fullSkip };

  for (const line of target.split('\n')) {
    const m = line.match(/^-\s*`([^`]+)`/);
    if (m) fullSkip.add(m[1]);
  }
  return { fullSkip };
}

// The one partial exception (Biology Problem of the Day's Contest 16/17 split) isn't worth
// a generic markdown parser for a single case - hardcoded here, cross-referenced in
// known-exceptions.md's "Partial exception" section.
const PARTIAL_EXCEPTION_FILE = 'Biology (Problem of the Day) - one-eighth to finals.docx';
const PARTIAL_EXCEPTION_HEADER_RE = /^Contest 1[67]\b/i;

function isPartialExceptionSegment(fileName, segment) {
  if (fileName !== PARTIAL_EXCEPTION_FILE) return false;
  const header = segment.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  return PARTIAL_EXCEPTION_HEADER_RE.test(header.trim());
}

// ---------------------------------------------------------------------------------------
// Bucket (seed-data) accumulation
// ---------------------------------------------------------------------------------------

function loadExistingBuckets() {
  const buckets = {};
  for (const [type, fileName] of Object.entries(ROUND_TYPE_FILE_MAP)) {
    const p = path.join(OUT_DIR, fileName);
    buckets[type] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
  }
  return buckets;
}

function removeQuestionsFromSource(buckets, fileName) {
  for (const type of Object.keys(buckets)) {
    buckets[type] = buckets[type].filter((q) => q.sourceFile !== fileName);
  }
}

// ---------------------------------------------------------------------------------------
// Per-file extraction (unchanged parsing/distractor logic, called for new/changed files)
// ---------------------------------------------------------------------------------------

// Round types named only in the file title / head (first 400 chars), the same signal
// analyzeRounds() in classify-questions.js uses. Mirrors that fallback: a type named in the
// title but absent from every segment body (e.g. "... - Speed race.docx" whose body carries
// no per-segment "SPEED RACE" header) would otherwise leave its segments matching nothing and
// silently defaulting to General.
function detectTitleRoundTypes(fileName, text) {
  const head = `${fileName}\n${(text || '').slice(0, 400)}`;
  const types = new Set();
  if (SPEED_RACE_RE.test(head)) types.add('SpeedRace');
  if (PROBLEM_OF_DAY_RE.test(head)) types.add('ProblemOfDay');
  if (TRUE_FALSE_RE.test(head)) types.add('TrueFalse');
  if (RIDDLE_RE.test(head)) types.add('Riddle');
  return types;
}

// ---------------------------------------------------------------------------------------
// Scoped SOLUTION-block parser: single-question "PROBLEM OF THE DAY-N.doc" files only.
// ---------------------------------------------------------------------------------------
// These files hold exactly one Problem-of-the-Day question laid out as: header lines
// (CONTEST N / PROBLEM OF THE DAY), then the question, then a standalone "SOLUTION" line, then
// the worked answer. Everything before SOLUTION (minus the headers) is the question; everything
// after is the answer. Deliberately NOT applied to the multi-question batched files
// (DOC-20190819, DOC-20190908, NSMQ Finals 2017 Maths PoD) - those need per-sub-question
// alignment that this simple split would mangle, so they're left unhandled for now.
const SOLUTION_BLOCK_SKIP = new Set([
  'DOC-20190819-WA0008.docx',
  'DOC-20190908-WA0002.docx',
  'NSMQ Finals 2017 - Maths Questions Problem of the day 2017.docx',
]);
// A header/label line at the top of the file that isn't part of the question text.
const POD_HEADER_LINE_RE = /^(?:CONTEST\s*\d+.*|ROUND\s*\d+.*|PROBLEM\s+OF\s+THE\s+DAY.*)$/i;

// Scoped by filename to the "PROBLEM OF THE DAY-*" set (the NSMQ Finals file merely mentions
// the phrase mid-name, so a start-anchored test excludes it - the explicit skip set is a
// second guard). Requires exactly one standalone SOLUTION line, which is what makes it a
// single-question file; anything with zero or several is left to the normal path / unhandled.
function isSolutionBlockFile(fileName, text) {
  if (SOLUTION_BLOCK_SKIP.has(fileName)) return false;
  if (!/^problem of the day/i.test(fileName)) return false;
  const solCount = (text || '').split(/\r?\n/).filter((l) => SOLUTION_STANDALONE_RE.test(l)).length;
  return solCount === 1;
}

function extractSolutionBlockFile(fileName, text, fileSubjectHint) {
  const questions = { General: [], SpeedRace: [], ProblemOfDay: [], TrueFalse: [], Riddle: [] };
  const warnings = [];
  const lines = text.split(/\r?\n/);
  const solIdx = lines.findIndex((l) => SOLUTION_STANDALONE_RE.test(l));

  const preLines = lines.slice(0, solIdx).map((l) => l.trim()).filter(Boolean);
  let qStart = 0;
  while (qStart < preLines.length && POD_HEADER_LINE_RE.test(preLines[qStart])) qStart++;
  const questionText = cleanText(preLines.slice(qStart).join(' '));
  const answerText = cleanAnswer(
    lines.slice(solIdx + 1).map((l) => l.trim()).filter(Boolean).join(' ')
  );

  if (!questionText || !answerText) {
    warnings.push(
      `[ProblemOfDay] SOLUTION-block file has ${!questionText ? 'no question' : 'no answer'} text - skipped`
    );
    return { questions, warnings };
  }

  const subject = inferSubject(`${questionText} ${answerText}`, fileSubjectHint);
  questions.ProblemOfDay.push({
    ...buildBase(fileName, subject, 'ProblemOfDay', questionText),
    questionText,
    correctAnswer: answerText,
    scored: false,
  });
  return { questions, warnings };
}

function extractFile(fileName, text) {
  const fileSubjectHint = [...detectSubjects(fileName, text)][0] || null;

  if (isSolutionBlockFile(fileName, text)) {
    return extractSolutionBlockFile(fileName, text, fileSubjectHint);
  }

  const allSegments = splitIntoSegments(text);
  const questions = { General: [], SpeedRace: [], ProblemOfDay: [], TrueFalse: [], Riddle: [] };
  const warnings = [];
  let defaultedCount = 0;
  let knownExceptionSegmentCount = 0;

  const segments = allSegments.filter((segment) => {
    if (isPartialExceptionSegment(fileName, segment)) {
      knownExceptionSegmentCount++;
      return false;
    }
    return true;
  });
  if (knownExceptionSegmentCount > 0) {
    warnings.push(
      `skipped ${knownExceptionSegmentCount} known-exception segment(s) (see known-exceptions.md)`
    );
  }

  // Decide what an unmatched segment should default to. If exactly one round type is named in
  // the title but never matched by any segment body, that whole file is very likely that one
  // round with the type only stated in the title - route unmatched segments there instead of
  // General. If zero or several such title-only types exist, it's ambiguous, so keep the
  // original General default rather than guess.
  const titleTypes = detectTitleRoundTypes(fileName, text);
  const segmentMatchedUnion = new Set();
  for (const segment of segments) {
    for (const t of matchSegmentTypes(segment)) segmentMatchedUnion.add(t);
  }
  const titleOnlyTypes = [...titleTypes].filter((t) => !segmentMatchedUnion.has(t));
  const fallbackType = titleOnlyTypes.length === 1 ? titleOnlyTypes[0] : 'General';

  for (const segment of segments) {
    let matchedTypes = matchSegmentTypes(segment);
    if (matchedTypes.length === 0) {
      defaultedCount++;
      matchedTypes = [fallbackType];
    }
    for (const type of matchedTypes) {
      const segWarnings = [];
      let segQuestions = [];
      if (type === 'General') segQuestions = extractGeneral(fileName, segment, fileSubjectHint, segWarnings);
      else if (type === 'ProblemOfDay')
        segQuestions = extractProblemOfDay(fileName, segment, fileSubjectHint, segWarnings);
      else if (type === 'SpeedRace')
        segQuestions = extractSpeedRace(fileName, segment, fileSubjectHint, segWarnings);
      else if (type === 'TrueFalse')
        segQuestions = extractTrueFalse(fileName, segment, fileSubjectHint, segWarnings);
      else if (type === 'Riddle') segQuestions = extractRiddle(fileName, segment, fileSubjectHint, segWarnings);

      questions[type].push(...segQuestions);
      warnings.push(...segWarnings);
    }
  }
  if (defaultedCount > 0) {
    warnings.push(`${defaultedCount} segment(s) had no round-type signal, defaulted to ${fallbackType}`);
  }

  return { questions, warnings };
}

// ---------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------

function parseArgs(argv) {
  const isDryRun = argv.includes('--dry-run');
  const refreshDuplicates = argv.includes('--refresh-duplicates');
  const onlyIdx = argv.indexOf('--only');
  const only =
    onlyIdx !== -1 && argv[onlyIdx + 1]
      ? argv[onlyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean)
      : null;
  return { isDryRun, only, refreshDuplicates };
}

function getCandidateFiles(only) {
  const all = fs
    .readdirSync(RAW_DIR)
    .filter((f) => fs.statSync(path.join(RAW_DIR, f)).isFile())
    .filter((f) => ['.doc', '.docx'].includes(path.extname(f).toLowerCase()))
    .sort();
  if (!only) return all;
  const allSet = new Set(all);
  const missing = only.filter((f) => !allSet.has(f));
  if (missing.length > 0) {
    throw new Error(`--only file(s) not found in ${path.relative(process.cwd(), RAW_DIR)}: ${missing.join(', ')}`);
  }
  return only;
}

// ---------------------------------------------------------------------------------------
// Content-hash de-duplication
// ---------------------------------------------------------------------------------------
// The corpus contains a lot of the same content saved under different filenames (.doc vs
// .docx, "(1)" copies, re-downloaded "-1"/"-1-1" variants, and even totally unrelated names).
// Filenames are NOT a reliable duplicate signal - many name-copies are actually different
// content and many identical files have unrelated names - so duplicates are decided purely by
// sha256 of the extracted text (the same hash manifest.json already stores). Grouping by exact
// hash guarantees content-distinct files (e.g. the genuinely different Problem-of-the-Day
// questions) are never collapsed together.

// Which file a duplicate group collapses to (its name becomes the sourceFile provenance on
// every extracted question, so "cleanest" matters): prefer .docx over .doc, then a descriptive
// name over an auto-generated export name like "DOC-20190819-WA0006.docx", then the shortest
// name, then lexicographic - deterministic so the same file always wins.
const AUTO_GENERATED_NAME_RE = /^(?:DOC|IMG|VID|AUD)-\d{6,}-WA\d+/i;
function pickCanonicalFile(group) {
  const extRank = (f) => {
    const e = path.extname(f).toLowerCase();
    return e === '.docx' ? 0 : e === '.doc' ? 1 : 2;
  };
  const autoRank = (f) => (AUTO_GENERATED_NAME_RE.test(f) ? 1 : 0);
  return [...group].sort(
    (a, b) => extRank(a) - extRank(b) || autoRank(a) - autoRank(b) || a.length - b.length || a.localeCompare(b)
  )[0];
}

// Hashes each file's extracted text and groups by identical content. Returns, for every
// non-canonical duplicate, the canonical file it collapses to, plus caches of the extracted
// text and hash so callers don't re-extract. Files whose text can't be extracted are left out
// entirely and never treated as a duplicate.
async function resolveDuplicates(files) {
  const byHash = new Map();
  const textByFile = new Map();
  const hashByFile = new Map();
  for (const fileName of files) {
    let text;
    try {
      text = await extractText(path.join(RAW_DIR, fileName));
    } catch {
      continue;
    }
    const h = sha256(text || '');
    textByFile.set(fileName, text || '');
    hashByFile.set(fileName, h);
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(fileName);
  }
  const duplicateOf = new Map();
  const groups = [];
  for (const g of byHash.values()) {
    if (g.length < 2) continue;
    groups.push(g);
    const canonical = pickCanonicalFile(g);
    for (const f of g) if (f !== canonical) duplicateOf.set(f, canonical);
  }
  return { duplicateOf, textByFile, hashByFile, groups };
}

// --refresh-duplicates: recompute duplicate groups over the whole corpus and record every
// non-canonical file in the manifest as skipped-duplicate (pointing at its canonical), also
// clearing any stale questions a previous run left in seed-data for those files. Writes the
// manifest and seed-data but runs no extraction - a cheap way to populate/refresh the dup list
// without a full processing pass.
async function refreshDuplicateManifest({ isDryRun }) {
  const manifest = loadManifest();
  const buckets = loadExistingBuckets();
  const allFiles = getCandidateFiles(null);
  const { duplicateOf, hashByFile, groups } = await resolveDuplicates(allFiles);

  let staleRemoved = 0;
  for (const [dup, canonical] of duplicateOf) {
    const before = Object.values(buckets).reduce((a, v) => a + v.filter((q) => q.sourceFile === dup).length, 0);
    removeQuestionsFromSource(buckets, dup);
    staleRemoved += before;
    manifest[dup] = {
      contentHash: hashByFile.get(dup),
      processedAt: new Date().toISOString(),
      status: 'skipped-duplicate',
      duplicateOf: canonical,
      questionsAdded: zeroCounts(),
    };
  }

  if (!isDryRun) {
    for (const [type, fileName] of Object.entries(ROUND_TYPE_FILE_MAP)) {
      fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(buckets[type], null, 2) + '\n', 'utf8');
    }
    writeManifest(manifest);
  }

  const line = (s = '') => console.log(s);
  line('='.repeat(90));
  line(`DUPLICATE REFRESH${isDryRun ? '  [DRY RUN - nothing written]' : ''}`);
  line('='.repeat(90));
  line(`Content-identical groups (2+ files): ${groups.length}`);
  line(`Files in those groups: ${groups.reduce((a, g) => a + g.length, 0)}`);
  line(`Recorded as skipped-duplicate (non-canonical): ${duplicateOf.size}`);
  line(`Canonicals kept for processing: ${groups.length}`);
  line(`Stale duplicate questions cleared from seed-data: ${staleRemoved}`);
  line();
  for (const g of [...groups].sort((a, b) => b.length - a.length)) {
    const canonical = pickCanonicalFile(g);
    line(`  [${g.length}] canonical: ${canonical}`);
    for (const f of g.filter((x) => x !== canonical).sort()) line(`         dup -> ${f}`);
  }
  line();
  line(isDryRun ? 'Dry run - manifest.json and seed-data not written.' : 'Wrote skipped-duplicate entries to manifest.json and cleaned seed-data.');
}

async function main() {
  const { isDryRun, only, refreshDuplicates } = parseArgs(process.argv.slice(2));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (refreshDuplicates) {
    await refreshDuplicateManifest({ isDryRun });
    return;
  }

  const manifest = loadManifest();
  const { fullSkip } = loadKnownExceptions();
  const buckets = loadExistingBuckets();
  const candidateFiles = getCandidateFiles(only);

  // Decide duplicates up front over the candidate set (over the whole corpus for a real run),
  // caching extracted text so the per-file loop below never re-extracts. Non-canonical
  // duplicates are skipped and recorded rather than reprocessed under a different filename.
  const { duplicateOf, textByFile, hashByFile } = await resolveDuplicates(candidateFiles);

  const report = { new: [], changed: [], skippedUnchanged: [], skippedKnownException: [], skippedDuplicate: [], errored: [] };
  const thisRunQuestions = { General: [], SpeedRace: [], ProblemOfDay: [], TrueFalse: [], Riddle: [] };
  const thisRunWarnings = [];

  for (const fileName of candidateFiles) {
    const filePath = path.join(RAW_DIR, fileName);
    let text;
    if (textByFile.has(fileName)) {
      text = textByFile.get(fileName);
    } else {
      try {
        text = await extractText(filePath);
      } catch (err) {
        report.errored.push(fileName);
        thisRunWarnings.push(`[${fileName}] skipped: could not extract text (${err.message})`);
        continue;
      }
    }
    const hash = hashByFile.get(fileName) || sha256(text || '');

    if (duplicateOf.has(fileName)) {
      const canonical = duplicateOf.get(fileName);
      report.skippedDuplicate.push(fileName);
      thisRunWarnings.push(`[${fileName}] skipped: duplicate of ${canonical}`);
      // Clear any stale entries a pre-dedup run may have written for this filename.
      removeQuestionsFromSource(buckets, fileName);
      if (!isDryRun) {
        manifest[fileName] = {
          contentHash: hash,
          processedAt: new Date().toISOString(),
          status: 'skipped-duplicate',
          duplicateOf: canonical,
          questionsAdded: zeroCounts(),
        };
      }
      continue;
    }

    const prior = manifest[fileName];

    if (fullSkip.has(fileName)) {
      report.skippedKnownException.push(fileName);
      thisRunWarnings.push(`[${fileName}] skipped: known exception`);
      if (!isDryRun) {
        manifest[fileName] = {
          contentHash: hash,
          processedAt: new Date().toISOString(),
          status: 'skipped-known-exception',
          questionsAdded: zeroCounts(),
        };
      }
      continue;
    }

    if (prior && prior.contentHash === hash) {
      report.skippedUnchanged.push(fileName);
      continue;
    }

    const isChanged = Boolean(prior);
    if (isChanged) {
      report.changed.push(fileName);
      thisRunWarnings.push(`[${fileName}] changed since last run (hash mismatch) - reprocessing`);
    } else {
      report.new.push(fileName);
    }
    // Unconditional, not just for the "changed" case: seed-data/*.json may already contain
    // entries for this file from before manifest.json existed (e.g. the original pilot run),
    // which would otherwise get duplicated alongside a freshly-generated batch. A no-op when
    // there's nothing to remove.
    removeQuestionsFromSource(buckets, fileName);

    const { questions, warnings } = extractFile(fileName, text);
    const addedCounts = {};
    for (const type of Object.keys(ROUND_TYPE_FILE_MAP)) {
      buckets[type].push(...questions[type]);
      thisRunQuestions[type].push(...questions[type]);
      addedCounts[type] = questions[type].length;
    }
    thisRunWarnings.push(...warnings.map((w) => `[${fileName}] ${w}`));

    if (!isDryRun) {
      manifest[fileName] = {
        contentHash: hash,
        processedAt: new Date().toISOString(),
        status: 'processed',
        questionsAdded: addedCounts,
      };
    }
  }

  if (!isDryRun) {
    for (const [type, fileName] of Object.entries(ROUND_TYPE_FILE_MAP)) {
      fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(buckets[type], null, 2) + '\n', 'utf8');
    }
    writeManifest(manifest);
  }

  printSummary({ isDryRun, report, buckets, thisRunQuestions, thisRunWarnings });
}

function printSummary({ isDryRun, report, buckets, thisRunQuestions, thisRunWarnings }) {
  const line = (s = '') => console.log(s);

  line('='.repeat(90));
  line(`STAGE 2 EXTRACTION SUMMARY${isDryRun ? '  [DRY RUN - nothing written]' : ''}`);
  line('='.repeat(90));
  line(`New files processed: ${report.new.length} ${report.new.length ? `(${report.new.join(', ')})` : ''}`);
  line(`Changed files reprocessed: ${report.changed.length} ${report.changed.length ? `(${report.changed.join(', ')})` : ''}`);
  line(`Skipped, unchanged: ${report.skippedUnchanged.length} ${report.skippedUnchanged.length ? `(${report.skippedUnchanged.join(', ')})` : ''}`);
  line(`Skipped, known exception: ${report.skippedKnownException.length} ${report.skippedKnownException.length ? `(${report.skippedKnownException.join(', ')})` : ''}`);
  line(`Skipped, duplicate: ${report.skippedDuplicate.length} ${report.skippedDuplicate.length ? `(${report.skippedDuplicate.join(', ')})` : ''}`);
  line(`Errored (text extraction failed): ${report.errored.length} ${report.errored.length ? `(${report.errored.join(', ')})` : ''}`);
  line();
  line(
    `Questions added this run: General ${thisRunQuestions.General.length}, SpeedRace ${thisRunQuestions.SpeedRace.length}, ` +
      `ProblemOfDay ${thisRunQuestions.ProblemOfDay.length}, TrueFalse ${thisRunQuestions.TrueFalse.length}, ` +
      `Riddle ${thisRunQuestions.Riddle.length}`
  );
  line(
    `Total accumulated in content/seed-data: General ${buckets.General.length}, SpeedRace ${buckets.SpeedRace.length}, ` +
      `ProblemOfDay ${buckets.ProblemOfDay.length}, TrueFalse ${buckets.TrueFalse.length}, ` +
      `Riddle ${buckets.Riddle.length}`
  );
  const flaggedGeneral = thisRunQuestions.General.filter((q) => q.possiblyCorrupted).length;
  const flaggedTrueFalse = thisRunQuestions.TrueFalse.filter((q) => q.possiblyCorrupted).length;
  line(
    `Flagged possiblyCorrupted this run: General ${flaggedGeneral}, ` +
      `TrueFalse ${flaggedTrueFalse} (also excludeFromServing)`
  );
  line();

  for (const [type, questions] of Object.entries(thisRunQuestions)) {
    line('-'.repeat(90));
    line(`${type} - added this run (${questions.length})`);
    line('-'.repeat(90));
    if (questions.length === 0) {
      line('  (none added this run)');
    }
    questions.forEach((q, i) => {
      line(`${i + 1}. [${q.subject || 'unknown subject'}] (${q.sourceFile})`);
      if (q.passageText) {
        line(`   Passage: ${q.passageText}`);
        line(`   Blanks: ${q.blanks.map((b) => `#${b.order}=${b.answer}`).join(', ')}`);
      } else {
        line(`   Q: ${q.questionText}`);
        line(`   Answer: ${q.correctAnswer}`);
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
  line(`WARNINGS (${thisRunWarnings.length})`);
  line('='.repeat(90));
  if (thisRunWarnings.length === 0) {
    line('  (none)');
  } else {
    thisRunWarnings.forEach((w) => line(`  - ${w}`));
  }
  line();
  if (isDryRun) {
    line('Dry run - no files were written.');
  } else {
    line(`Wrote output to ${path.relative(process.cwd(), OUT_DIR)}/{general,speed-race,problem-of-the-day,true-false,riddles}.json`);
    line(`Wrote manifest to ${path.relative(process.cwd(), MANIFEST_PATH)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
