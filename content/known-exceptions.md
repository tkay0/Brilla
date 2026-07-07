# Known Exceptions

Files (or specific segments within a file) where questions and answers are split
across separate source files or separate top-level sections, in a way extract.js's
segment-level parsing can't reassemble. Found while investigating extraction gaps -
see conversation history for how each was diagnosed. Rather than emitting parse
warnings for these every run, extract.js skips them and logs a single
`skipped: known exception` line per file.

## Files to skip entirely

- `CONTEST 40.doc` - has the Problem of the Day question (a 67-hotels facilities
  survey); the answer lives entirely in a separate file, `CONTEST 40 DIAGRAM.docx`.
- `CONTEST 40 DIAGRAM.docx` - the answer/diagram for the question in `CONTEST 40.doc`.
  Contains no question text at all on its own.
- `2017 REGIONAL SICENCE 5-9.docx` - `CONTEST 5` and its answer key
  (`CONTEST 5 SOLUTION`) are separate top-level boundaries, not paired within one
  segment.
- `2018.docx` - the Problem of the Day round for Contests 21, 25, and 29 is missing
  inline with those contests and instead appended as a batch (`ROUND 3 CONTEST 21`,
  `ROUND 3 CONTEST 25`, `ROUND 3 CONTEST 29`) at the very end of the document, ~88
  segments away from where the rest of those contests' content lives.
- `2018 (1).docx` - same relocation issue as `2018.docx` (near-duplicate file).

## Partial exception (file processes normally otherwise)

- `Biology (Problem of the Day) - one-eighth to finals.docx` - the General round in
  this file parses correctly and should NOT be skipped. Only the `Contest 16` /
  `Contest 16 - Answers` and `Contest 17` / `Contest 17 - Answer` segment pairs are
  affected (question and answer split into separate segments) and are skipped
  specifically, by segment header match, rather than skipping the whole file.
