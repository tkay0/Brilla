import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { $Enums } from '../generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CONTENT_DIR = path.join(__dirname, '../../../content/seed-data');

interface SourceClue {
  order: number;
  text: string;
}

interface SourceQuestion {
  id: string;
  sourceFile: string;
  subject: string | null;
  questionText: string;
  correctAnswer: string | boolean;
  options?: string[];
  clues?: SourceClue[];
  scored: boolean;
  possiblyCorrupted?: boolean;
  excludeFromServing?: boolean;
}

const FILES: { file: string; roundType: $Enums.RoundType }[] = [
  { file: 'general.json', roundType: 'General' },
  { file: 'speed-race.json', roundType: 'SpeedRace' },
  { file: 'problem-of-the-day.json', roundType: 'ProblemOfDay' },
  { file: 'true-false.json', roundType: 'TrueFalse' },
  { file: 'riddles.json', roundType: 'Riddle' },
];

/**
 * The source IDs are content hashes, but a handful collide across genuinely
 * different rows (short/blank questionText hashing the same). Since the id is
 * the Question primary key, we keep the last occurrence in file order and log
 * how many groups had actually-different content so it's visible, not silent.
 */
function dedupeById(
  items: SourceQuestion[],
  fileLabel: string,
): SourceQuestion[] {
  const byId = new Map<string, SourceQuestion[]>();
  for (const item of items) {
    const group = byId.get(item.id);
    if (group) group.push(item);
    else byId.set(item.id, [item]);
  }

  let duplicateGroups = 0;
  let conflictingGroups = 0;
  const deduped: SourceQuestion[] = [];
  for (const group of byId.values()) {
    if (group.length > 1) {
      duplicateGroups++;
      const distinctContent = new Set(group.map((g) => JSON.stringify(g)));
      if (distinctContent.size > 1) conflictingGroups++;
    }
    deduped.push(group[group.length - 1]);
  }

  if (duplicateGroups > 0) {
    console.warn(
      `  [${fileLabel}] ${duplicateGroups} duplicate id(s) in source (${conflictingGroups} had conflicting content) -> kept last occurrence, ${items.length - deduped.length} row(s) collapsed`,
    );
  }

  return deduped;
}

function normalizeCorrectAnswer(value: string | boolean): string {
  return typeof value === 'boolean' ? String(value) : value;
}

async function bulkUpsertQuestions(
  items: SourceQuestion[],
  roundType: $Enums.RoundType,
): Promise<void> {
  const chunkSize = 500;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    for (const item of chunk) {
      values.push(
        `($${p++}, $${p++}, $${p++}::"RoundType", $${p++}, $${p++}, $${p++}, $${p++}::jsonb, $${p++}, $${p++}, $${p++})`,
      );
      params.push(
        item.id,
        item.subject,
        roundType,
        item.sourceFile,
        item.questionText,
        normalizeCorrectAnswer(item.correctAnswer),
        item.options ? JSON.stringify(item.options) : null,
        item.scored,
        item.possiblyCorrupted ?? null,
        item.excludeFromServing ?? null,
      );
    }

    const sql = `
      INSERT INTO "Question"
        (id, subject, "roundType", "sourceFile", "questionText", "correctAnswer", options, scored, "possiblyCorrupted", "excludeFromServing")
      VALUES ${values.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
        subject = EXCLUDED.subject,
        "roundType" = EXCLUDED."roundType",
        "sourceFile" = EXCLUDED."sourceFile",
        "questionText" = EXCLUDED."questionText",
        "correctAnswer" = EXCLUDED."correctAnswer",
        options = EXCLUDED.options,
        scored = EXCLUDED.scored,
        "possiblyCorrupted" = EXCLUDED."possiblyCorrupted",
        "excludeFromServing" = EXCLUDED."excludeFromServing"
    `;

    await prisma.$executeRawUnsafe(sql, ...params);
  }
}

async function replaceRiddleClues(items: SourceQuestion[]): Promise<number> {
  const ids = items.map((item) => item.id);
  await prisma.riddleClue.deleteMany({ where: { questionId: { in: ids } } });

  const rows = items.flatMap((item) =>
    (item.clues ?? []).map((clue) => ({
      questionId: item.id,
      order: clue.order,
      clueText: clue.text,
    })),
  );

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await prisma.riddleClue.createMany({ data: rows.slice(i, i + chunkSize) });
  }

  return rows.length;
}

async function importFile(
  file: string,
  roundType: $Enums.RoundType,
): Promise<{ questions: number; clues: number }> {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const items = JSON.parse(raw) as SourceQuestion[];
  const deduped = dedupeById(items, file);

  await bulkUpsertQuestions(deduped, roundType);
  const clues = await replaceRiddleClues(deduped);

  return { questions: deduped.length, clues };
}

async function main() {
  const summary: Record<string, { questions: number; clues: number }> = {};

  for (const { file, roundType } of FILES) {
    console.log(`Importing ${file} as ${roundType}...`);
    summary[roundType] = await importFile(file, roundType);
  }

  console.log('\nImport summary:');
  let total = 0;
  for (const [roundType, result] of Object.entries(summary)) {
    console.log(
      `  ${roundType}: ${result.questions} questions, ${result.clues} clues`,
    );
    total += result.questions;
  }
  console.log(`  TOTAL questions: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
