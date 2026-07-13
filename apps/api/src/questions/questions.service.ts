import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoundType } from '../../generated/prisma/enums.js';
import { DailyLimitsService } from '../daily-limits/daily-limits.service';
import { isMcqRoundType, resolveRoundTypes } from './round-type-param.js';

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface ServedQuestion {
  id: string;
  subject: string | null;
  roundType: RoundType;
  questionText: string;
  correctAnswer: string;
  options: unknown[] | null;
  clues?: { order: number; clueText: string }[];
}

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyLimits: DailyLimitsService,
  ) {}

  async getBatch(
    userId: string,
    roundTypeParam: string,
    count: number,
  ): Promise<ServedQuestion[]> {
    const roundTypes = resolveRoundTypes(roundTypeParam);

    for (const roundType of roundTypes) {
      await this.dailyLimits.assertUnderLimit(userId, roundType);
    }

    const candidates = await this.prisma.question.findMany({
      where: {
        roundType: { in: roundTypes },
        OR: [{ excludeFromServing: null }, { excludeFromServing: false }],
      },
      select: { id: true },
    });

    const selectedIds = shuffle(candidates).slice(0, count).map((c) => c.id);

    const rows = await this.prisma.question.findMany({
      where: { id: { in: selectedIds } },
      include: { riddleClues: { orderBy: { order: 'asc' } } },
    });

    const rowsById = new Map(rows.map((row) => [row.id, row]));

    return selectedIds.map((id) => {
      const row = rowsById.get(id)!;
      const options = Array.isArray(row.options)
        ? isMcqRoundType(row.roundType)
          ? shuffle(row.options)
          : row.options
        : null;

      const question: ServedQuestion = {
        id: row.id,
        subject: row.subject,
        roundType: row.roundType,
        questionText: row.questionText,
        correctAnswer: row.correctAnswer,
        options,
      };

      if (row.roundType === RoundType.Riddle) {
        question.clues = row.riddleClues
          .sort((a, b) => a.order - b.order)
          .map((clue) => ({ order: clue.order, clueText: clue.clueText }));
      }

      return question;
    });
  }
}
